import { Schema, Document, Model, models, model } from "mongoose";

export interface ApplicationEntity extends Document {
  user_id: string;
  name: string;
  allowed_origins: string[];
  allowed_urls: string[];
}

const ApplicationSchema = new Schema<ApplicationEntity>({
  user_id: String,
  name: String,
  allowed_origins: [String],
  allowed_urls: [String],
});

ApplicationSchema.index({ user_id: 1 });
ApplicationSchema.index({ allowed_origins: 1 });

export const ApplicationEntity: Model<ApplicationEntity> =
  models.Application || model("Application", ApplicationSchema);
