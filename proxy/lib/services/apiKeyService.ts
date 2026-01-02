import { CacheableMemory } from "cacheable";
import { UserV2Entity } from "../../models/UserV2Entity";
import { getPubSubClient } from "./pubSubService";

export interface ApiKeyUser {
  id: string;
  subscription_active?: boolean;
  subscription_product_id?: string;
  trial_ends_at?: Date;
}

const apiKeyCache = new CacheableMemory({
  ttl: "5m",
  lruSize: 1000,
});

export const getUserByApiKey = async (
  apiKey: string
): Promise<ApiKeyUser | null> => {
  const cacheKey = `apikey:${apiKey}`;
  const cached = apiKeyCache.get<ApiKeyUser | "invalid">(cacheKey);

  if (cached === "invalid") {
    return null;
  }
  if (cached) {
    return cached;
  }

  const user = await UserV2Entity.findOne({ api_key: apiKey }).lean();

  if (!user) {
    apiKeyCache.set(cacheKey, "invalid");
    return null;
  }

  const apiKeyUser: ApiKeyUser = {
    id: user.legacy_id || user._id.toString(),
    subscription_active: user.subscription_active,
    subscription_product_id: user.subscription_product_id,
    trial_ends_at: user.trial_ends_at,
  };

  apiKeyCache.set(cacheKey, apiKeyUser);
  return apiKeyUser;
};

export const registerApiKeyInvalidateCacheHandlers = () => {
  const pubSub = getPubSubClient();

  pubSub.subscribe("apikey-invalidate", (err) => {
    if (err) console.error(err);
    console.log(`Subscribed to apikey-invalidate channel.`);
  });

  pubSub.on("message", (channel, message) => {
    if (channel === "apikey-invalidate") {
      apiKeyCache.delete(`apikey:${message}`);
    }
  });
};
