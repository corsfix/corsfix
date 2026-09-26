import mongoose, { Document, Model, Schema } from "mongoose";

// OAuth clients created through Dynamic Client Registration (RFC 7591).
// Clients that identify themselves with a Client ID Metadata Document are not
// stored here; their metadata is fetched from the client_id URL.
export interface OAuthClientEntity extends Document<string> {
  _id: string;
  client_secret_hash?: string;
  client_name: string;
  client_uri?: string;
  logo_uri?: string;
  redirect_uris: string[];
  grant_types: string[];
  token_endpoint_auth_method: string;
  software_id?: string;
  software_version?: string;
  created_at: Date;
  expires_at: Date;
}

const OAuthClientSchema = new Schema<OAuthClientEntity>(
  {
    _id: String,
    client_secret_hash: String,
    client_name: String,
    client_uri: String,
    logo_uri: String,
    redirect_uris: [String],
    grant_types: [String],
    token_endpoint_auth_method: String,
    software_id: String,
    software_version: String,
    created_at: Date,
    expires_at: Date,
  },
  { collection: "oauth_clients" }
);

OAuthClientSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const OAuthClientEntity: Model<OAuthClientEntity> =
  mongoose.models.OAuthClient ||
  mongoose.model("OAuthClient", OAuthClientSchema);
