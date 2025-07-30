import { CacheableMemory } from "cacheable";
import { SubscriptionEntity } from "../../models/SubscriptionEntity";
import { Subscription } from "../../types/api";

const subscriptionCache = new CacheableMemory({
  ttl: "5m",
  lruSize: 1000,
});

export const getActiveSubscription = async (
  user_id: string
): Promise<Subscription | null> => {
  let subscription = subscriptionCache.get<Subscription>(user_id);
  if (subscription) {
    return subscription;
  }
  const subscriptionEntity = await SubscriptionEntity.findOne({
    user_id: user_id,
    active: true,
  }).lean();

  if (!subscriptionEntity) {
    return null;
  }

  subscription = {
    user_id: subscriptionEntity.user_id,
    product_id: subscriptionEntity.product_id,
    active: subscriptionEntity.active,
  };

  subscriptionCache.set(user_id, subscription);

  return subscription;
};
