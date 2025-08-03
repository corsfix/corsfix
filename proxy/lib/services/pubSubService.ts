import Redis from "ioredis";

const REDIS_URI = process.env.REDIS_URI;
if (!REDIS_URI) {
  throw new Error("Please define the REDIS_URI environment variable");
}
const pubSubClient = new Redis(REDIS_URI, { lazyConnect: true });

export const initPubSub = async () => {
  await pubSubClient.connect();
};

export const getPubSubClient = () => {
  return pubSubClient;
};
