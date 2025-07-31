import Redis from "ioredis";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-var
  var redis: {
    conn: null | Redis;
    promise: null | Promise<Redis>;
  };
}

let cached = global.redis;

if (!cached) {
  cached = global.redis = { conn: null, promise: null };
}

async function redisConnect() {
  const REDIS_URI = process.env.REDIS_URI;

  if (!REDIS_URI) {
    throw new Error(
      "Please define the REDIS_URI environment variable inside .env.local"
    );
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    };
    
    cached.promise = new Promise<Redis>((resolve, reject) => {
      const client = new Redis(REDIS_URI, opts);
      
      client.on('connect', () => {
        resolve(client);
      });
      
      client.on('error', (err) => {
        cached.promise = null;
        reject(err);
      });
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default redisConnect;
