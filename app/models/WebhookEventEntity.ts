import mongoose, { Schema, Document, Model } from "mongoose";

export interface WebhookEventEntity extends Document {
  type: string;
  data: object;
}

const WebhookEventSchema = new Schema<WebhookEventEntity>({
  type: String,
  data: Object,
});

export const WebhookEventEntity: Model<WebhookEventEntity> =
  mongoose.models.WebhookEvent ||
  mongoose.model("WebhookEvent", WebhookEventSchema);
