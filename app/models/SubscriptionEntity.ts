import mongoose, { Schema, Document, Model } from "mongoose";

export interface SubscriptionEntity extends Document {
  _id: string;
  user_id: string;
  product_id: string;
  customer_id: string;
  active: boolean;
}

const SubscriptionSchema = new Schema<SubscriptionEntity>({
  _id: String,
  user_id: String,
  product_id: String,
  customer_id: String,
  active: Boolean,
});

SubscriptionSchema.index({ product_id: 1 });
SubscriptionSchema.index({ active: 1 });

export const SubscriptionEntity: Model<SubscriptionEntity> =
  mongoose.models.Subscription ||
  mongoose.model("Subscription", SubscriptionSchema);
