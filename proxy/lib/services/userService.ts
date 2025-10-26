import { CacheableMemory } from "cacheable";
import mongoose from "mongoose";
import { UserV2Entity } from "../../models/UserV2Entity";

const userCache = new CacheableMemory({
  ttl: "1m",
  lruSize: 1000,
});

export const isTrialActive = async (userId: string): Promise<boolean> => {
  const cacheKey = `trial_${userId}`;
  let isActive = userCache.get<boolean>(cacheKey);
  if (isActive !== undefined) {
    return isActive;
  }
  const user = mongoose.isValidObjectId(userId)
    ? await UserV2Entity.findOne({ _id: userId })
    : await UserV2Entity.findOne({ legacy_id: userId });

  if (!user) {
    return false;
  }

  const now = new Date();
  const trialEndsAt =
    user.trial_ends_at || new Date("2025-10-05T00:00:00.000Z");

  isActive = now < trialEndsAt;

  userCache.set(cacheKey, isActive);

  return isActive;
};

export const getUser = async (userId: string): Promise<UserV2Entity | null> => {
  const cacheKey = userId;
  let cachedUser = userCache.get<UserV2Entity>(cacheKey);
  if (cachedUser !== undefined) {
    return cachedUser;
  }
  const user = mongoose.isValidObjectId(userId)
    ? await UserV2Entity.findOne({ _id: userId })
    : await UserV2Entity.findOne({ legacy_id: userId });

  if (!user) {
    return null;
  }

  userCache.set(cacheKey, user.toJSON());

  return user;
};
