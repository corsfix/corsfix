import * as z from "zod";
import dbConnect from "@/lib/dbConnect";
import redisConnect from "@/lib/redisConnect";
import { OAuthClientEntity } from "@/models/OAuthClientEntity";
import { REGISTERED_CLIENT_TTL_SECONDS } from "@/lib/oauth/config";
import { TOKEN_PREFIX, hashToken, randomToken } from "@/lib/oauth/crypto";
import { validateRedirectUri } from "@/lib/oauth/redirectUri";
import { getClientIp, oauthJson, preflightResponse } from "@/lib/oauth/http";

export const dynamic = "force-dynamic";

// OAuth 2.0 Dynamic Client Registration (RFC 7591). The 2026-07-28 MCP spec
// prefers Client ID Metadata Documents, but most MCP clients in use today
// still register this way.

const RegistrationSchema = z.object({
  redirect_uris: z.array(z.string()).min(1).max(10),
  client_name: z.string().max(200).optional(),
  client_uri: z.string().max(2048).optional(),
  logo_uri: z.string().max(2048).optional(),
  grant_types: z.array(z.string()).max(10).optional(),
  response_types: z.array(z.string()).max(10).optional(),
  token_endpoint_auth_method: z.string().max(64).optional(),
  scope: z.string().max(1024).optional(),
  software_id: z.string().max(200).optional(),
  software_version: z.string().max(100).optional(),
});

const SUPPORTED_GRANT_TYPES = ["authorization_code", "refresh_token"];
const SUPPORTED_AUTH_METHODS = [
  "none",
  "client_secret_basic",
  "client_secret_post",
];
const REGISTRATIONS_PER_IP_PER_HOUR = 30;

const registrationError = (error: string, description: string) =>
  oauthJson({ error, error_description: description }, 400);

const httpsUrlOrUndefined = (value?: string) => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

async function isRateLimited(req: Request): Promise<boolean> {
  try {
    const redis = await redisConnect();
    const hour = Math.floor(Date.now() / 3_600_000);
    const key = `oauth:register:${getClientIp(req)}:${hour}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 3600);
    return count > REGISTRATIONS_PER_IP_PER_HOUR;
  } catch (error) {
    // Registration keeps working if Redis is unavailable.
    console.error("OAuth registration rate limit check failed", error);
    return false;
  }
}

export async function POST(req: Request) {
  if (await isRateLimited(req)) {
    return oauthJson(
      {
        error: "temporarily_unavailable",
        error_description: "Too many client registrations. Try again later.",
      },
      429
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return registrationError(
      "invalid_client_metadata",
      "The request body must be a JSON object."
    );
  }

  const parsed = RegistrationSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join(".") || "request";
    return registrationError(
      field.startsWith("redirect_uris")
        ? "invalid_redirect_uri"
        : "invalid_client_metadata",
      `${field}: ${issue?.message ?? "invalid value"}`
    );
  }
  const metadata = parsed.data;

  for (const uri of metadata.redirect_uris) {
    const problem = validateRedirectUri(uri);
    if (problem) {
      return registrationError(
        "invalid_redirect_uri",
        `Redirect URI ${uri} ${problem}.`
      );
    }
  }

  const grantTypes = metadata.grant_types ?? SUPPORTED_GRANT_TYPES;
  if (
    !grantTypes.includes("authorization_code") ||
    grantTypes.some((grant) => !SUPPORTED_GRANT_TYPES.includes(grant))
  ) {
    return registrationError(
      "invalid_client_metadata",
      "grant_types must include authorization_code and may only add refresh_token."
    );
  }

  const responseTypes = metadata.response_types ?? ["code"];
  if (responseTypes.some((type) => type !== "code")) {
    return registrationError(
      "invalid_client_metadata",
      "Only the code response type is supported."
    );
  }

  const authMethod = metadata.token_endpoint_auth_method ?? "none";
  if (!SUPPORTED_AUTH_METHODS.includes(authMethod)) {
    return registrationError(
      "invalid_client_metadata",
      `token_endpoint_auth_method must be one of: ${SUPPORTED_AUTH_METHODS.join(
        ", "
      )}.`
    );
  }

  const clientId = randomToken(TOKEN_PREFIX.clientId, 16);
  const clientSecret =
    authMethod === "none" ? undefined : randomToken(TOKEN_PREFIX.clientSecret);
  const clientName = metadata.client_name?.trim() || "MCP client";
  const clientUri = httpsUrlOrUndefined(metadata.client_uri);
  const logoUri = httpsUrlOrUndefined(metadata.logo_uri);
  const now = new Date();

  await dbConnect();
  await OAuthClientEntity.create({
    _id: clientId,
    client_secret_hash: clientSecret ? hashToken(clientSecret) : undefined,
    client_name: clientName,
    client_uri: clientUri,
    logo_uri: logoUri,
    redirect_uris: metadata.redirect_uris,
    grant_types: grantTypes,
    token_endpoint_auth_method: authMethod,
    software_id: metadata.software_id,
    software_version: metadata.software_version,
    created_at: now,
    expires_at: new Date(now.getTime() + REGISTERED_CLIENT_TTL_SECONDS * 1000),
  });

  return oauthJson(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(now.getTime() / 1000),
      ...(clientSecret
        ? { client_secret: clientSecret, client_secret_expires_at: 0 }
        : {}),
      client_name: clientName,
      ...(clientUri ? { client_uri: clientUri } : {}),
      ...(logoUri ? { logo_uri: logoUri } : {}),
      redirect_uris: metadata.redirect_uris,
      grant_types: grantTypes,
      response_types: responseTypes,
      token_endpoint_auth_method: authMethod,
    },
    201
  );
}

export function OPTIONS() {
  return preflightResponse();
}
