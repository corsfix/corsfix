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

const rpm60 = new RateLimiterMemory({
  points: 60,
  duration: 60,
});
const rpm120 = new RateLimiterMemory({
  points: 120,
  duration: 60,
});
const rpm180 = new RateLimiterMemory({
  points: 180,
  duration: 60,
});

let rpm60Redis: RateLimiterRedis;
let rpm120Redis: RateLimiterRedis;
let rpm180Redis: RateLimiterRedis;

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
      switch (rpm) {
        case 60:
          rateLimiterRes = await rpm60.consume(key);
          break;
        case 120:
          rateLimiterRes = await rpm120.consume(key);
          break;
        case 180:
          rateLimiterRes = await rpm180.consume(key);
          break;
        default:
          rateLimiterRes = await rpm60.consume(key);
      }
    } else {
      switch (rpm) {
        case 60:
          rateLimiterRes = await consumeSyncRedis(rpm60, rpm60Redis, key);
          break;
        case 120:
          rateLimiterRes = await consumeSyncRedis(rpm120, rpm120Redis, key);
          break;
        case 180:
          rateLimiterRes = await consumeSyncRedis(rpm180, rpm180Redis, key);
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

export const registerGlobalRateLimiter = () => {
  const redisClient = getRedisClient();

  rpm60Redis = new RateLimiterRedis({
    points: 60,
    duration: 60,
    storeClient: redisClient,
    keyPrefix: "rpm60",
  });

  rpm120Redis = new RateLimiterRedis({
    points: 120,
    duration: 60,
    storeClient: redisClient,
    keyPrefix: "rpm120",
  });

  rpm180Redis = new RateLimiterRedis({
    points: 180,
    duration: 60,
    storeClient: redisClient,
    keyPrefix: "rpm180",
  });
};
