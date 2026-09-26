import mongoose, { Document, Model, Schema } from "mongoose";

export type OAuthTokenKind = "access" | "refresh";

// Access and refresh tokens. _id is the SHA-256 hash of the token. A refresh
// token is marked with used_at when it is rotated; presenting it again is
// treated as token theft and revokes the whole grant.
export interface OAuthTokenEntity extends Document<string> {
  _id: string;
  kind: OAuthTokenKind;
  grant_id: string;
  user_id: string;
  client_id: string;
  scope: string;
  resource: string;
  created_at: Date;
  expires_at: Date;
  used_at?: Date;
}

const OAuthTokenSchema = new Schema<OAuthTokenEntity>(
  {
    _id: String,
    kind: String,
    grant_id: String,
    user_id: String,
    client_id: String,
    scope: String,
    resource: String,
    created_at: Date,
    expires_at: Date,
    used_at: Date,
  },
  { collection: "oauth_tokens" }
);

OAuthTokenSchema.index({ grant_id: 1 });
OAuthTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const OAuthTokenEntity: Model<OAuthTokenEntity> =
  mongoose.models.OAuthToken || mongoose.model("OAuthToken", OAuthTokenSchema);
