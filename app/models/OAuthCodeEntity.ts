import mongoose, { Document, Model, Schema } from "mongoose";

// Single-use authorization codes. _id is the SHA-256 hash of the code. Used
// codes are kept (with used_at and the grant they created) until they expire,
// so a second use can be detected.
export interface OAuthCodeEntity extends Document<string> {
  _id: string;
  client_id: string;
  client_name: string;
  client_uri?: string;
  user_id: string;
  redirect_uri: string;
  code_challenge: string;
  scope: string;
  resource: string;
  created_at: Date;
  expires_at: Date;
  used_at?: Date;
  grant_id?: string;
  replayed_at?: Date;
}

const OAuthCodeSchema = new Schema<OAuthCodeEntity>(
  {
    _id: String,
    client_id: String,
    client_name: String,
    client_uri: String,
    user_id: String,
    redirect_uri: String,
    code_challenge: String,
    scope: String,
    resource: String,
    created_at: Date,
    expires_at: Date,
    used_at: Date,
    grant_id: String,
    replayed_at: Date,
  },
  { collection: "oauth_codes" }
);

OAuthCodeSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const OAuthCodeEntity: Model<OAuthCodeEntity> =
  mongoose.models.OAuthCode || mongoose.model("OAuthCode", OAuthCodeSchema);
