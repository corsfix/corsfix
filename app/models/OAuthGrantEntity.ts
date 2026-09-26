import mongoose, { Document, Model, Schema } from "mongoose";

// One grant per approved connection between a user and an MCP client. Access
// and refresh tokens belong to a grant, so disconnecting an app from the
// dashboard (or detecting refresh token reuse) revokes all of its tokens.
export interface OAuthGrantEntity extends Document<string> {
  _id: string;
  user_id: string;
  client_id: string;
  client_name: string;
  client_uri?: string;
  redirect_uri: string;
  scope: string;
  resource: string;
  created_at: Date;
  last_used_at: Date;
  expires_at: Date;
}

const OAuthGrantSchema = new Schema<OAuthGrantEntity>(
  {
    _id: String,
    user_id: String,
    client_id: String,
    client_name: String,
    client_uri: String,
    redirect_uri: String,
    scope: String,
    resource: String,
    created_at: Date,
    last_used_at: Date,
    expires_at: Date,
  },
  { collection: "oauth_grants" }
);

OAuthGrantSchema.index({ user_id: 1 });
OAuthGrantSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const OAuthGrantEntity: Model<OAuthGrantEntity> =
  mongoose.models.OAuthGrant || mongoose.model("OAuthGrant", OAuthGrantSchema);
