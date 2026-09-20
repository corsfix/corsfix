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

// IPs already admitted for a free tier domain in the current window. Only
// ever contains IPs that were admitted in Redis, so a local hit is safe to
// trust without a round trip.
const freeTierIpCache = new CacheableMemory({
  ttl: LOCAL_CACHE_TTL_MS,
  lruSize: 5000,
});

// Atomically admit an IP into the window's set if it is already a member or
// the set still has room. Returns 1 when admitted, 0 when the limit is hit.
const FREE_TIER_ADMIT_SCRIPT = `
if redis.call('SISMEMBER', KEYS[1], ARGV[1]) == 1 then
  return 1
end
if redis.call('SCARD', KEYS[1]) < tonumber(ARGV[2]) then
  redis.call('SADD', KEYS[1], ARGV[1])
  redis.call('EXPIRE', KEYS[1], ARGV[3])
  return 1
end
return 0
`;

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

export const admitFreeTierIp = async (
  domain: string,
  ip: string,
  limit: number
): Promise<boolean> => {
  const windowKey = Math.floor(Date.now() / WINDOW_MS);
  const cacheKey = `free:${domain}:${windowKey}`;

  const ips = freeTierIpCache.get<Set<string>>(cacheKey);
  if (ips?.has(ip)) {
    return true;
  }

  const redis = getRedisClient();
  if (!redis) return true;

  try {
    const result = await redis.eval(
      FREE_TIER_ADMIT_SCRIPT,
      1,
      `conc:free:${domain}:${windowKey}`,
      ip,
      limit,
      REDIS_KEY_TTL_SECONDS
    );
    if (result !== 1) {
      return false;
    }
  } catch (err) {
    // Fail open: a Redis outage should not take free tier sites down.
    console.error("free tier concurrency check failed", err);
    return true;
  }

  const admitted = ips ?? new Set<string>();
  admitted.add(ip);
  freeTierIpCache.set(cacheKey, admitted);
  return true;
};
