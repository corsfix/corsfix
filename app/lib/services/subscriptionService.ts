import { Subscription } from "@/types/api";
import dbConnect from "../dbConnect";
import { SubscriptionEntity } from "@/models/SubscriptionEntity";
import { config } from "@/config/constants";

export async function getActiveSubscription(
  user_id: string
): Promise<Subscription> {
  await dbConnect();

  const subscription = await SubscriptionEntity.findOne({
    user_id: user_id,
    active: true,
  }).lean();

  if (!subscription) {
    return {
      name: "free",
      customer_id: user_id,
      bandwidth: 50_000_000,
      active: false,
    };
  }

  const product = config.products.find(
    (product) => product.id === subscription.product_id
  );

  return {
    name: product?.name || "-",
    product_id: subscription.product_id,
    customer_id: subscription.customer_id,
    bandwidth: product?.bandwidth || 0,
    active: subscription.active,
  };
}
