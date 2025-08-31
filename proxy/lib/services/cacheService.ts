import Redis from "ioredis";

let redisClient: Redis;

export const initRedis = async () => {
  const REDIS_URI = process.env.REDIS_URI;
  if (!REDIS_URI) {
    throw new Error("Please define the REDIS_URI environment variable");
  }
  redisClient = new Redis(REDIS_URI, { lazyConnect: true });
  await redisClient.connect();
};

export const getRedisClient = () => {
  return redisClient;
};
