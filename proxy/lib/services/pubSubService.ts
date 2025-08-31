import Redis from "ioredis";

let pubSubClient: Redis;

export const initPubSub = async () => {
  const REDIS_URI = process.env.REDIS_URI;
  if (!REDIS_URI) {
    throw new Error("Please define the REDIS_URI environment variable");
  }
  pubSubClient = new Redis(REDIS_URI, { lazyConnect: true });
  await pubSubClient.connect();
};

export const getPubSubClient = () => {
  return pubSubClient;
};
