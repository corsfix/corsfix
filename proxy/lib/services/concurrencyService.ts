import { CacheableMemory } from "cacheable";
import { getRedisClient } from "./cacheService";
import { UserConcurrencyDailyEntity } from "../../models/UserConcurrencyDailyEntity";

const WINDOW_MS = 60 * 1000;
const WINDOW_SECONDS = WINDOW_MS / 1000;
const LOCAL_CACHE_TTL_MS = WINDOW_MS + 10 * 1000;
const REDIS_KEY_TTL_SECONDS = WINDOW_SECONDS * 2;

const localIpCache = new CacheableMemory({
  ttl: LOCAL_CACHE_TTL_MS,
  lruSize: 5000,
});

const dailyPeakCache = new CacheableMemory({
  ttl: "25h",
  lruSize: 5000,
});

const getDateKey = (): Date => {
  const date = new Date();
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
};

const flushPeak = (userId: string, dateKey: Date, peak: number): void => {
  UserConcurrencyDailyEntity.updateOne(
    { user_id: userId, date: dateKey },
    { $max: { peak_concurrent: peak } },
    { upsert: true }
  ).catch((err) => console.error("concurrency upsert failed", err));
};

const updateDailyPeak = (
  userId: string,
  dateKey: Date,
  count: number
): void => {
  const cacheKey = `${userId}:${dateKey.getTime()}`;
  const currentPeak = dailyPeakCache.get<number>(cacheKey) ?? 0;

  if (count > currentPeak) {
    dailyPeakCache.set(cacheKey, count);
    flushPeak(userId, dateKey, count);
  }
};

const syncToRedis = async (
  userId: string,
  ip: string,
  windowKey: number,
  dateKey: Date
): Promise<void> => {
  const redis = getRedisClient();
  if (!redis) return;

  const redisKey = `conc:${userId}:${windowKey}`;
  try {
    const result = await redis
      .pipeline()
      .sadd(redisKey, ip)
      .scard(redisKey)
      .expire(redisKey, REDIS_KEY_TTL_SECONDS)
      .exec();

    if (!result) return;
    const [scardError, scardValue] = result[1] ?? [];
    if (scardError) return;
    // IP concurrency number for a user in this window -> conc:${userId}:${windowKey}
    const globalCount = scardValue as number;

    // calculate the daily running max for this user
    updateDailyPeak(userId, dateKey, globalCount);
  } catch (err) {
    console.error("concurrency redis sync failed", err);
  }
};

export const trackConcurrency = (userId: string, ip: string): void => {
  const now = Date.now();
  const windowKey = Math.floor(now / WINDOW_MS);
  const cacheKey = `${userId}:${windowKey}`;

  const ips = localIpCache.get<Set<string>>(cacheKey) ?? new Set<string>();
  if (ips.has(ip)) {
    return;
  }
  ips.add(ip);
  localIpCache.set(cacheKey, ips);

  syncToRedis(userId, ip, windowKey, getDateKey());
};
