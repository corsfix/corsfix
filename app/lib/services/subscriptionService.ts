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
    active: subscription.active,
  };
}
