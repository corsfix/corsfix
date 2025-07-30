import mongoose, { Document, Model, Schema } from "mongoose";

export interface UserOriginDailyEntity extends Document {
  _id: string;
  user_id: string;
  origin: string;
  date: Date;
  req_count: number;
  bytes: number;
}

const UserOriginDailySchema = new Schema<UserOriginDailyEntity>({
  _id: String,
  user_id: String,
  origin: String,
  date: Date,
  req_count: Number,
  bytes: Number,
});

UserOriginDailySchema.index({ user_id: 1, date: 1 });
UserOriginDailySchema.index({ user_id: 1, origin: 1, date: 1 });

export const UserOriginDailyEntity: Model<UserOriginDailyEntity> =
  mongoose.models.UserOriginDaily ||
  mongoose.model("UserOriginDaily", UserOriginDailySchema);
