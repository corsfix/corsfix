import redisConnect from "@/lib/redisConnect";

// Fixed-window counter in Redis. Returns true when the call is allowed. If
// Redis is unavailable the call is allowed, so tools keep working.
export async function allowCall(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const redis = await redisConnect();
    const window = Math.floor(Date.now() / (windowSeconds * 1000));
    const redisKey = `mcp:ratelimit:${key}:${window}`;
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, windowSeconds);
    return count <= limit;
  } catch (error) {
    console.error("MCP rate limit check failed", error);
    return true;
  }
}
