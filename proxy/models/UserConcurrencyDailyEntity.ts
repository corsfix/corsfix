import mongoose, { Document, Model, Schema } from "mongoose";

export interface UserConcurrencyDailyEntity extends Document {
  user_id: string;
  date: Date;
  peak_concurrent: number;
}

const UserConcurrencyDailySchema = new Schema<UserConcurrencyDailyEntity>({
  user_id: String,
  date: Date,
  peak_concurrent: Number,
});

UserConcurrencyDailySchema.index({ user_id: 1, date: 1 });

export const UserConcurrencyDailyEntity: Model<UserConcurrencyDailyEntity> =
  mongoose.models.UserConcurrencyDaily ||
  mongoose.model("UserConcurrencyDaily", UserConcurrencyDailySchema);
