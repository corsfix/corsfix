import { Subscription } from "@/types/api";
import dbConnect from "../dbConnect";
import { config } from "@/config/constants";
import { UserV2Entity } from "@/models/UserV2Entity";

export async function getActiveSubscription(
  user_id: string
): Promise<Subscription> {
  await dbConnect();

  const user = await UserV2Entity.findOne({
    _id: user_id,
  }).lean();

  if (!user?.subscription_active) {
    return {
      name: "-",
      bandwidth: 0,
      active: false,
    };
  }

  const product = config.products.find(
    (product) => product.id === user.subscription_product_id
  );

  return {
    name: product?.name || "-",
    product_id: user.subscription_product_id,
    customer_id: user.customer_id,
    bandwidth: product?.bandwidth || 0,
    active: user.subscription_active,
  };
}
