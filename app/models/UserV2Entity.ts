import mongoose, { Schema, Document, Model } from "mongoose";

export interface UserV2Entity extends Document {
  name?: string;
  email: string;
  legacy_id?: string;
  hash?: string;
}

const UserV2Schema = new Schema<UserV2Entity>(
  {
    name: String,
    email: String,
    legacy_id: String,
    hash: String,
  },
  { collection: "usersv2" }
);

UserV2Schema.index({ email: 1 });
UserV2Schema.index({ legacy_id: 1 });

export const UserV2Entity: Model<UserV2Entity> =
  mongoose.models.UserV2 || mongoose.model("UserV2", UserV2Schema);
