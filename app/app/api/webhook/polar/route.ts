import { Subscription } from "@polar-sh/sdk/models/components/subscription";
import { WebhookSubscriptionActivePayload } from "@polar-sh/sdk/models/components/webhooksubscriptionactivepayload";
import { WebhookSubscriptionRevokedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionrevokedpayload";
import { WebhookOrderCreatedPayload } from "@polar-sh/sdk/models/components/webhookordercreatedpayload";
import { type NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { WebhookEventEntity } from "@/models/WebhookEventEntity";
import { validateEvent } from "@polar-sh/sdk/webhooks";
import { SubscriptionEntity } from "@/models/SubscriptionEntity";
import { Order } from "@polar-sh/sdk/models/components/order.js";
import { UserV2Entity } from "@/models/UserV2Entity";

const logEvent = async (
  event:
    | WebhookSubscriptionActivePayload
    | WebhookSubscriptionRevokedPayload
    | WebhookOrderCreatedPayload
) => {
  console.log(event);
  await dbConnect();
  await WebhookEventEntity.create(event);
};

const handleSubscriptionActive = async (subscriptionData: Subscription) => {
  await dbConnect();

  const { productId, customer } = subscriptionData;
  const { email } = customer;

  // 1. find user
  const user = await UserV2Entity.findOne({ email: email });
  if (!user) {
    return;
  }

  // 2. activate subscription
  await SubscriptionEntity.findOneAndUpdate(
    { product_id: productId, user_id: user.id, customer_id: customer.id },
    { active: true },
    { upsert: true }
  );

  user.subscription_product_id = productId;
  user.customer_id = customer.id;
  user.subscription_active = true;
  await user.save();
};

const handleSubscriptionRevoked = async (subscriptionData: Subscription) => {
  await dbConnect();

  const { productId, user: customer } = subscriptionData;
  const { email } = customer;

  // 1. get user
  const user = await UserV2Entity.findOne({ email: email });
  if (!user) {
    return;
  }

  // 2. revoke subscription
  await SubscriptionEntity.findOneAndUpdate(
    { product_id: productId, user_id: user.id },
    { active: false },
    { upsert: true }
  );
  user.subscription_active = false;
  await user.save();
};

const handleSubscriptionUpdated = async (order: Order) => {
  await dbConnect();

  const { productId, customer } = order;
  const { email } = customer;

  // 1. get user
  const user = await UserV2Entity.findOne({ email: email });
  if (!user) {
    return;
  }

  // 2. revoke old subscription
  await SubscriptionEntity.findOneAndUpdate(
    { user_id: user.id, active: true },
    { active: false },
    { upsert: true }
  );

  // 3. activate new subscription
  await SubscriptionEntity.findOneAndUpdate(
    { product_id: productId, user_id: user.id, customer_id: customer.id },
    { active: true },
    { upsert: true }
  );

  user.subscription_product_id = productId;
  await user.save();
};

export async function POST(request: NextRequest) {
  const requestBody = await request.text();

  const webhookHeaders = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
  };

  const event = validateEvent(
    requestBody,
    webhookHeaders,
    process.env.POLAR_WEBHOOK_SECRET as string
  );

  switch (event.type) {
    case "subscription.active":
      logEvent(event);
      handleSubscriptionActive(event.data);
      break;
    case "subscription.revoked":
      logEvent(event);
      handleSubscriptionRevoked(event.data);
      break;
    case "order.created":
      if (event.data.billingReason === "subscription_update") {
        logEvent(event);
        handleSubscriptionUpdated(event.data);
      }
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
