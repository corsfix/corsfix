import crypto from "crypto";
import dbConnect from "../dbConnect";
import redisConnect from "../redisConnect";
import { UserV2Entity } from "@/models/UserV2Entity";

export async function getApiKey(userId: string): Promise<string | null> {
  await dbConnect();
  const user = await UserV2Entity.findById(userId).lean();
  return user?.api_key ?? null;
}

export async function generateApiKey(userId: string): Promise<string> {
  await dbConnect();

  const user = await UserV2Entity.findById(userId);
  if (!user) throw new Error("User not found");

  const oldKey = user.api_key;

  const maxAttempts = 5;
  let key: string | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = "cfx_" + crypto.randomBytes(16).toString("hex");
    const existingUser = await UserV2Entity.findOne({ api_key: candidate }).lean();
    if (!existingUser) {
      key = candidate;
      break;
    }
  }

  if (!key) {
    throw new Error("Failed to generate a unique API key");
  }
  user.api_key = key;
  await user.save();

  // Invalidate old key cache in proxy
  if (oldKey) {
    const redis = await redisConnect();
    redis.publish("apikey-invalidate", oldKey);
  }

  return key;
}

export async function deleteApiKey(userId: string): Promise<void> {
  await dbConnect();

  const user = await UserV2Entity.findById(userId);
  if (!user) return;

  const oldKey = user.api_key;

  user.api_key = undefined;
  await user.save();

  // Invalidate cache in proxy
  if (oldKey) {
    const redis = await redisConnect();
    redis.publish("apikey-invalidate", oldKey);
  }
}
