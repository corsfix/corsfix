import {
  RateLimiterMemory,
  RateLimiterRedis,
  RateLimiterRes,
} from "rate-limiter-flexible";
import { RateLimitConfig } from "../../types/api";
import { getRedisClient } from "./cacheService";

interface RateLimitResult {
  isAllowed: boolean;
  headers: Record<string, string>;
}

const SYNC_THRESHOLD = 10;

const redisClient = getRedisClient();

const rpm60 = new RateLimiterMemory({
  points: 60,
  duration: 60,
});

const rpm150 = new RateLimiterMemory({
  points: 150,
  duration: 60,
});

const rpm150Redis = new RateLimiterRedis({
  points: 150,
  duration: 60,
  storeClient: redisClient,
  keyPrefix: "rpm150",
});

const rpm300 = new RateLimiterMemory({
  points: 300,
  duration: 60,
});

const rpm300Redis = new RateLimiterRedis({
  points: 300,
  duration: 60,
  storeClient: redisClient,
  keyPrefix: "rpm300",
});

const rpm600 = new RateLimiterMemory({
  points: 600,
  duration: 60,
});

const rpm600Redis = new RateLimiterRedis({
  points: 600,
  duration: 60,
  storeClient: redisClient,
  keyPrefix: "rpm600",
});

const consumeSyncRedis = async (
  rateLimiterMemory: RateLimiterMemory,
  rateLimiterRedis: RateLimiterRedis,
  key: string
): Promise<RateLimiterRes> => {
  let memoryRes = await rateLimiterMemory.consume(key);

  if (memoryRes.consumedPoints % SYNC_THRESHOLD === 0) {
    console.log("Syncing rate limit data to Redis");
    let redisRes;
    let shouldThrow = false;
    try {
      redisRes = await rateLimiterRedis.consume(key, SYNC_THRESHOLD);
    } catch (error) {
      if (error instanceof Error) {
        console.error("Redis Error: ", error);
      } else {
        redisRes = error as RateLimiterRes;
        shouldThrow = true;
      }
    }

    if (redisRes) {
      await rateLimiterMemory.set(
        key,
        redisRes.consumedPoints,
        redisRes.msBeforeNext / 1000
      );
      memoryRes = redisRes;

      if (shouldThrow) {
        throw redisRes;
      }
    }
  }

  return memoryRes;
};

export const checkRateLimit = async (
  config: RateLimitConfig
): Promise<RateLimitResult> => {
  const { key, rpm, local } = config;
  try {
    let rateLimiterRes;
    if (local) {
      rateLimiterRes = await rpm60.consume(key);
    } else {
      switch (rpm) {
        case 150:
          rateLimiterRes = await consumeSyncRedis(rpm150, rpm150Redis, key);
          break;
        case 300:
          rateLimiterRes = await consumeSyncRedis(rpm300, rpm300Redis, key);
          break;
        case 600:
          rateLimiterRes = await consumeSyncRedis(rpm600, rpm600Redis, key);
          break;
        default:
          rateLimiterRes = await rpm60.consume(key);
      }
    }

    return {
      isAllowed: true,
      headers: getRateLimitHeaders(rateLimiterRes, rpm),
    };
  } catch (error) {
    const rateLimiterRes = error as RateLimiterRes;
    return {
      isAllowed: false,
      headers: getRateLimitHeaders(rateLimiterRes, rpm),
    };
  }
};

const getRateLimitHeaders = (rateLimiterRes: RateLimiterRes, rpm: number) => {
  return {
    "X-RateLimit-Limit": `${rpm}`,
    "X-RateLimit-Remaining": `${Math.max(0, rateLimiterRes.remainingPoints)}`,
    "X-RateLimit-Used": `${rateLimiterRes.consumedPoints}`,
    "X-RateLimit-Reset": new Date(Date.now() + rateLimiterRes.msBeforeNext)
      .getTime()
      .toString(),
  };
};
