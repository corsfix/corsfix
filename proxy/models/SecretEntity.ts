import mongoose, { Schema, Document, Model, models, model } from "mongoose";

export interface EncryptedObject {
  iv: string;
  encrypted: string;
  tag: string;
}

export interface SecretEntity extends Document {
  application_id: mongoose.Types.ObjectId;
  user_id: string;
  name: string;
  note: string;
  masked_value: string;
  data: EncryptedObject;
  dek: EncryptedObject;
  kek_version: string;
}

const SecretSchema = new Schema<SecretEntity>({
  application_id: mongoose.Types.ObjectId,
  user_id: String,
  name: String,
  note: String,
  masked_value: String,
  data: Object,
  dek: Object,
  kek_version: String,
});

SecretSchema.index({ application_id: 1 });

export const SecretEntity: Model<SecretEntity> =
  models.Secret || model("Secret", SecretSchema);
