import { Subject } from "rxjs";
import { bufferTime } from "rxjs/operators";
import { getRedisClient } from "./cacheService";
import { FreeTierMonthlyEntity } from "../../models/FreeTierMonthlyEntity";
import { FreeTier } from "../../types/api";
import { freeTierLimit } from "../../config/constants";

// Mongo is the source of truth for free tier data transfer. Redis holds a
// live copy so the hot path never waits on Mongo. Every recorded response
// refreshes the Redis TTL, so an actively used domain never falls back to
// Mongo while writes are still buffered.
const REDIS_CACHE_TTL_SECONDS = 10 * 60;
const BUFFER_TIME_MS = 30_000;
const MAX_BATCH_SIZE = 300;

interface FreeTierEvent {
  domain: string;
  month: string;
  count: number;
  bytes: number;
}

const freeTierEvents$ = new Subject<FreeTierEvent>();

// Increment only when the key already exists, otherwise a plain INCRBY would
// create a key that misses the bytes already stored in Mongo.
const INCR_IF_EXISTS_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  local value = redis.call('INCRBY', KEYS[1], ARGV[1])
  redis.call('EXPIRE', KEYS[1], ARGV[2])
  return value
end
return nil
`;

export const getFreeTierMonthKey = (date: Date = new Date()): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

export const getFreeTierMonthlyId = (domain: string, month: string): string =>
  `${domain}:${month}`;

const getRedisKey = (domain: string, month: string): string =>
  `free:transfer:${domain}:${month}`;

export const getFreeTierByteLimit = (tier: FreeTier): number =>
  tier === "registered"
    ? freeTierLimit.registeredBytes
    : freeTierLimit.unregisteredBytes;

export const getFreeTierBytes = async (domain: string): Promise<number> => {
  const month = getFreeTierMonthKey();
  const redisKey = getRedisKey(domain, month);
  const redis = getRedisClient();

  try {
    const cached = await redis.get(redisKey);
    if (cached !== null) {
      const parsed = parseInt(cached, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    }
  } catch (err) {
    console.error("free tier redis read failed", err);
  }

  let bytes = 0;
  try {
    const doc = await FreeTierMonthlyEntity.findById(
      getFreeTierMonthlyId(domain, month)
    ).lean();
    bytes = doc?.bytes ?? 0;
  } catch (err) {
    console.error("free tier mongo read failed", err);
    return 0;
  }

  try {
    // NX so a concurrent INCRBY that landed first is never overwritten.
    await redis.set(redisKey, String(bytes), "EX", REDIS_CACHE_TTL_SECONDS, "NX");
  } catch (err) {
    console.error("free tier redis populate failed", err);
  }

  return bytes;
};

export const recordFreeTierBytes = (domain: string, bytes: number): void => {
  if (!bytes || bytes <= 0) return;

  const month = getFreeTierMonthKey();
  const redis = getRedisClient();

  redis
    .eval(
      INCR_IF_EXISTS_SCRIPT,
      1,
      getRedisKey(domain, month),
      bytes,
      REDIS_CACHE_TTL_SECONDS
    )
    .catch((err) => console.error("free tier redis increment failed", err));

  freeTierEvents$.next({ domain, month, count: 1, bytes });
};

freeTierEvents$
  .pipe(bufferTime(BUFFER_TIME_MS, undefined, MAX_BATCH_SIZE))
  .subscribe(async (batch) => {
    if (!batch.length) return;
    try {
      await processBatch(batch);
    } catch (error) {
      console.error("Error processing free tier batch.", error);
    }
  });

const processBatch = async (events: FreeTierEvent[]): Promise<void> => {
  const aggregated = events.reduce((map, { domain, month, count, bytes }) => {
    const key = getFreeTierMonthlyId(domain, month);
    const entry = map.get(key) ?? { domain, month, count: 0, bytes: 0 };
    entry.count += count;
    entry.bytes += bytes;
    map.set(key, entry);
    return map;
  }, new Map<string, FreeTierEvent>());

  const bulkOps = Array.from(aggregated.entries()).map(
    ([id, { domain, month, count, bytes }]) => ({
      updateOne: {
        filter: { _id: id },
        update: {
          $inc: { req_count: count, bytes },
          $setOnInsert: { domain, month },
        },
        upsert: true,
      },
    })
  );

  if (bulkOps.length > 0) {
    await FreeTierMonthlyEntity.bulkWrite(bulkOps);
  }
};

export const flushPendingFreeTierMetrics = async (): Promise<void> => {
  return new Promise((resolve) => {
    if (freeTierEvents$.closed) {
      resolve();
      return;
    }

    const subscription = freeTierEvents$.subscribe({
      complete: () => {
        subscription.unsubscribe();
        resolve();
      },
      error: () => {
        subscription.unsubscribe();
        resolve();
      },
    });

    freeTierEvents$.complete();
  });
};
