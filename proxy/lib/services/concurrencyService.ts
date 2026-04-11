import { CacheableMemory } from "cacheable";
import { getRedisClient } from "./cacheService";
import { UserConcurrencyDailyEntity } from "../../models/UserConcurrencyDailyEntity";

const localIpCache = new CacheableMemory({
  ttl: "70s",
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

const flushPeak = (userId: string, peak: number): void => {
  UserConcurrencyDailyEntity.updateOne(
    { user_id: userId, date: getDateKey() },
    { $max: { peak_concurrent: peak } },
    { upsert: true }
  ).catch((err) => console.error("concurrency upsert failed", err));
};

const updateDailyPeak = (userId: string, count: number): void => {
  const cacheKey = `${userId}:${getDateKey().getTime()}`;
  const currentPeak = dailyPeakCache.get<number>(cacheKey) ?? 0;

  if (count > currentPeak) {
    dailyPeakCache.set(cacheKey, count);
    flushPeak(userId, count);
  }
};

const syncToRedis = async (
  userId: string,
  ip: string,
  minuteKey: number
): Promise<void> => {
  const redis = getRedisClient();
  if (!redis) return;

  const redisKey = `conc:${userId}:${minuteKey}`;
  try {
    const result = await redis
      .pipeline()
      .sadd(redisKey, ip)
      .scard(redisKey)
      .expire(redisKey, 120)
      .exec();

    if (!result) return;
    const [scardError, scardValue] = result[1] ?? [];
    if (scardError) return;
    // IP concurrency number for a user in this minute -> conc:${userId}:${minuteKey}
    const globalCount = scardValue as number;

    // calculate the daily running max for this user
    updateDailyPeak(userId, globalCount);
  } catch (err) {
    console.error("concurrency redis sync failed", err);
  }
};

export const trackConcurrency = (userId: string, ip: string): void => {
  const now = Date.now();
  const minuteKey = Math.floor(now / 60000);
  const cacheKey = `${userId}:${minuteKey}`;

  const ips = localIpCache.get<Set<string>>(cacheKey) ?? new Set<string>();
  if (ips.has(ip)) {
    return;
  }
  ips.add(ip);
  localIpCache.set(cacheKey, ips);

  syncToRedis(userId, ip, minuteKey);
};
