import { Schema, Document, Model, models, model } from "mongoose";

export interface ApplicationEntity extends Document {
  user_id: string;
  name: string;
  origin_domains: string[];
  target_domains: string[];
}

const ApplicationSchema = new Schema<ApplicationEntity>({
  user_id: String,
  name: String,
  origin_domains: [String],
  target_domains: [String],
});

ApplicationSchema.index({ user_id: 1 });
ApplicationSchema.index({ origin_domains: 1 });

export const ApplicationEntity: Model<ApplicationEntity> =
  models.Application || model("Application", ApplicationSchema);
