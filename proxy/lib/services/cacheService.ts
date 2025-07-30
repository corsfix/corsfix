import Redis from "ioredis";

const REDIS_URI = process.env.REDIS_URI;
if (!REDIS_URI) {
  throw new Error("Please define the REDIS_URI environment variable");
}
const redisClient = new Redis(REDIS_URI, { lazyConnect: true });

export const initRedis = async () => {
  await redisClient.connect();
};

export const getRedisClient = () => {
  return redisClient;
};
