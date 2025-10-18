import mongoose, { Schema, Document, Model } from "mongoose";

export interface UserV2Entity extends Document {
  name?: string;
  email: string;
  legacy_id?: string;
  hash?: string;
  trial_ends_at?: Date;
  customer_id?: string;
  subscription_product_id?: string;
  subscription_active?: boolean;
}

const UserV2Schema = new Schema<UserV2Entity>(
  {
    name: String,
    email: String,
    legacy_id: String,
    hash: String,
    trial_ends_at: Date,
    customer_id: String,
    subscription_product_id: String,
    subscription_active: Boolean,
  },
  { collection: "usersv2" }
);

UserV2Schema.index({ email: 1 });
UserV2Schema.index({ legacy_id: 1 });

export const UserV2Entity: Model<UserV2Entity> =
  mongoose.models.UserV2 || mongoose.model("UserV2", UserV2Schema);
