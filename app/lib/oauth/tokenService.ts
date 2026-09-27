import crypto from "crypto";
import dbConnect from "@/lib/dbConnect";
import { OAuthCodeEntity } from "@/models/OAuthCodeEntity";
import { OAuthGrantEntity } from "@/models/OAuthGrantEntity";
import { OAuthTokenEntity } from "@/models/OAuthTokenEntity";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTHORIZATION_CODE_TTL_SECONDS,
  REFRESH_TOKEN_REUSE_GRACE_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "./config";
import { OAuthClient } from "./clientService";
import { TOKEN_PREFIX, hashToken, randomToken, verifyPkceS256 } from "./crypto";

export class OAuthTokenError extends Error {
  constructor(
    public error: string,
    public description: string,
    public status = 400
  ) {
    super(description);
  }
}

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface AccessTokenInfo {
  userId: string;
  clientId: string;
  grantId: string;
  scopes: string[];
  resource: string;
  expiresAt: number;
}

export interface GrantSummary {
  id: string;
  clientName: string;
  clientUri?: string;
  redirectUri: string;
  createdAt: Date;
  lastUsedAt: Date;
}

const secondsFromNow = (seconds: number) =>
  new Date(Date.now() + seconds * 1000);

export async function createAuthorizationCode({
  client,
  userId,
  redirectUri,
  codeChallenge,
  scope,
  resource,
}: {
  client: OAuthClient;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  resource: string;
}): Promise<string> {
  await dbConnect();
  const code = randomToken(TOKEN_PREFIX.authorizationCode);
  await OAuthCodeEntity.create({
    _id: hashToken(code),
    client_id: client.client_id,
    client_name: client.client_name,
    client_uri: client.client_uri,
    user_id: userId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    scope,
    resource,
    created_at: new Date(),
    expires_at: secondsFromNow(AUTHORIZATION_CODE_TTL_SECONDS),
  });
  return code;
}

async function issueTokens(grant: {
  _id: string;
  user_id: string;
  client_id: string;
  scope: string;
  resource: string;
}): Promise<TokenResponse> {
  const accessToken = randomToken(TOKEN_PREFIX.accessToken);
  const refreshToken = randomToken(TOKEN_PREFIX.refreshToken);
  const now = new Date();
  const shared = {
    grant_id: grant._id,
    user_id: grant.user_id,
    client_id: grant.client_id,
    scope: grant.scope,
    resource: grant.resource,
    created_at: now,
  };

  await OAuthTokenEntity.insertMany([
    {
      _id: hashToken(accessToken),
      kind: "access",
      expires_at: secondsFromNow(ACCESS_TOKEN_TTL_SECONDS),
      ...shared,
    },
    {
      _id: hashToken(refreshToken),
      kind: "refresh",
      expires_at: secondsFromNow(REFRESH_TOKEN_TTL_SECONDS),
      ...shared,
    },
  ]);

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: grant.scope,
  };
}

export async function exchangeAuthorizationCode({
  client,
  code,
  codeVerifier,
  redirectUri,
  resource,
}: {
  client: OAuthClient;
  code: string;
  codeVerifier: string;
  redirectUri?: string;
  resource?: string | null;
}): Promise<TokenResponse> {
  await dbConnect();
  const codeHash = hashToken(code);
  const now = new Date();

  // Every check runs before the code is used up, so a request with a wrong
  // verifier or redirect_uri cannot spend the legitimate client's code.
  const stored = await OAuthCodeEntity.findById(codeHash).lean();
  if (!stored || stored.expires_at <= now) {
    throw new OAuthTokenError(
      "invalid_grant",
      "The authorization code is invalid or has expired."
    );
  }
  if (stored.client_id !== client.client_id) {
    throw new OAuthTokenError(
      "invalid_grant",
      "The authorization code was issued to a different client."
    );
  }
  // OAuth 2.1 clients leave redirect_uri out of the token request; when it
  // is sent, it must be identical to the one in the authorization request
  // (RFC 6749 section 4.1.3), including a loopback port.
  if (redirectUri !== undefined && redirectUri !== stored.redirect_uri) {
    throw new OAuthTokenError(
      "invalid_grant",
      "redirect_uri does not match the authorization request."
    );
  }
  if (!verifyPkceS256(codeVerifier, stored.code_challenge)) {
    throw new OAuthTokenError(
      "invalid_grant",
      "The code_verifier does not match the code_challenge."
    );
  }
  if (resource && resource !== stored.resource) {
    throw new OAuthTokenError(
      "invalid_target",
      "The resource does not match the authorization request."
    );
  }

  const alreadyUsed = new OAuthTokenError(
    "invalid_grant",
    "The authorization code has already been used."
  );
  if (stored.used_at) {
    // A second valid request with a used code: deny it and revoke what the
    // first one received (OAuth 2.1 section 4.1.3).
    if (stored.grant_id) await revokeGrantTokens(stored.grant_id);
    throw alreadyUsed;
  }

  // Claim the code atomically so two concurrent requests cannot both succeed.
  const claimed = await OAuthCodeEntity.findOneAndUpdate(
    { _id: codeHash, used_at: { $exists: false } },
    { $set: { used_at: now } }
  ).lean();
  if (!claimed) throw alreadyUsed;

  const grant = await OAuthGrantEntity.create({
    _id: crypto.randomBytes(16).toString("hex"),
    user_id: stored.user_id,
    client_id: stored.client_id,
    client_name: stored.client_name,
    client_uri: stored.client_uri,
    redirect_uri: stored.redirect_uri,
    scope: stored.scope,
    resource: stored.resource,
    created_at: now,
    last_used_at: now,
    expires_at: secondsFromNow(REFRESH_TOKEN_TTL_SECONDS),
  });
  await OAuthCodeEntity.updateOne(
    { _id: codeHash },
    { $set: { grant_id: grant._id } }
  );

  return issueTokens(grant);
}

// Deleting the grant is what revokes access: access tokens and refresh
// tokens are only accepted while their grant exists. Deleting the tokens
// afterwards is cleanup.
async function revokeGrantTokens(grantId: string): Promise<void> {
  await OAuthGrantEntity.deleteOne({ _id: grantId });
  await OAuthTokenEntity.deleteMany({ grant_id: grantId });
}

export async function refreshTokens({
  client,
  refreshToken,
  resource,
}: {
  client: OAuthClient;
  refreshToken: string;
  resource?: string | null;
}): Promise<TokenResponse> {
  await dbConnect();
  const now = new Date();
  const tokenHash = hashToken(refreshToken);

  // Rotation: each refresh token works once. The update only matches an
  // unused, unexpired token of this client (and resource), so two concurrent
  // refreshes cannot both win, and a rejected request does not use it up.
  const stored = await OAuthTokenEntity.findOneAndUpdate(
    {
      _id: tokenHash,
      kind: "refresh",
      client_id: client.client_id,
      used_at: { $exists: false },
      expires_at: { $gt: now },
      ...(resource ? { resource } : {}),
    },
    { $set: { used_at: now } }
  ).lean();

  if (!stored) {
    const previous = await OAuthTokenEntity.findById(tokenHash).lean();
    if (previous?.kind === "refresh" && previous.expires_at > now) {
      if (previous.client_id !== client.client_id) {
        throw new OAuthTokenError(
          "invalid_grant",
          "The refresh token was issued to a different client."
        );
      }
      if (resource && resource !== previous.resource) {
        throw new OAuthTokenError(
          "invalid_target",
          "The resource does not match the original authorization."
        );
      }
      if (previous.used_at) {
        const sinceRotation = now.getTime() - previous.used_at.getTime();
        if (sinceRotation <= REFRESH_TOKEN_REUSE_GRACE_SECONDS * 1000) {
          // The token was rotated moments ago, most likely by a concurrent
          // refresh from the same client (several requests noticing an
          // expired access token at once). Give this request its own token
          // pair instead of disconnecting the app.
          return issueTokensForGrant(previous.grant_id, now);
        }
        // A rotated refresh token was replayed later: assume it leaked and
        // cut off every token in the grant (OAuth 2.1 section 4.3.1).
        await revokeGrantTokens(previous.grant_id);
      }
    }
    throw new OAuthTokenError(
      "invalid_grant",
      "The refresh token is invalid, expired or already used."
    );
  }

  // The rotated token is kept (marked used) until it expires so a replay can
  // be detected; the previous access token stays valid until it expires.
  return issueTokensForGrant(stored.grant_id, now);
}

async function issueTokensForGrant(
  grantId: string,
  now: Date
): Promise<TokenResponse> {
  const grant = await OAuthGrantEntity.findOneAndUpdate(
    { _id: grantId, expires_at: { $gt: now } },
    {
      $set: {
        last_used_at: now,
        expires_at: secondsFromNow(REFRESH_TOKEN_TTL_SECONDS),
      },
    },
    { new: true }
  ).lean();
  if (!grant) {
    throw new OAuthTokenError(
      "invalid_grant",
      "This connection was removed. Connect the app again."
    );
  }
  return issueTokens(grant);
}

export async function verifyAccessToken(
  token: string,
  expectedResource: string
): Promise<AccessTokenInfo | null> {
  if (!token.startsWith(TOKEN_PREFIX.accessToken)) return null;

  await dbConnect();
  const now = new Date();
  const stored = await OAuthTokenEntity.findById(hashToken(token)).lean();

  if (
    !stored ||
    stored.kind !== "access" ||
    stored.expires_at <= now ||
    stored.resource !== expectedResource
  ) {
    return null;
  }

  // The token only works while its connection exists, so disconnecting an
  // app cuts it off even if cleaning up its tokens failed.
  const grant = await OAuthGrantEntity.findById(stored.grant_id)
    .select({ last_used_at: 1, expires_at: 1 })
    .lean();
  if (!grant || grant.expires_at <= now) return null;

  // Keep "last used" roughly current for the connected apps list without
  // writing on every request.
  if ((grant.last_used_at?.getTime() ?? 0) < now.getTime() - 5 * 60 * 1000) {
    OAuthGrantEntity.updateOne(
      { _id: stored.grant_id },
      { $set: { last_used_at: now } }
    ).catch((error) => console.error("Failed to update grant usage", error));
  }

  return {
    userId: stored.user_id,
    clientId: stored.client_id,
    grantId: stored.grant_id,
    scopes: stored.scope.split(" ").filter(Boolean),
    resource: stored.resource,
    expiresAt: Math.floor(stored.expires_at.getTime() / 1000),
  };
}

// RFC 7009. Revoking a refresh token ends the whole connection; revoking an
// access token only removes that token. Unknown tokens are ignored.
export async function revokeToken(
  token: string,
  clientId: string
): Promise<void> {
  await dbConnect();
  const stored = await OAuthTokenEntity.findById(hashToken(token)).lean();
  if (!stored || stored.client_id !== clientId) return;

  if (stored.kind === "refresh") {
    await revokeGrantTokens(stored.grant_id);
  } else {
    await OAuthTokenEntity.deleteOne({ _id: stored._id });
  }
}

export async function listGrants(userId: string): Promise<GrantSummary[]> {
  await dbConnect();
  const grants = await OAuthGrantEntity.find({
    user_id: userId,
    expires_at: { $gt: new Date() },
  })
    .sort({ last_used_at: -1 })
    .lean();

  return grants.map((grant) => ({
    id: grant._id,
    clientName: grant.client_name,
    clientUri: grant.client_uri,
    redirectUri: grant.redirect_uri,
    createdAt: grant.created_at,
    lastUsedAt: grant.last_used_at,
  }));
}

export async function revokeGrant(
  userId: string,
  grantId: string
): Promise<boolean> {
  await dbConnect();
  const grant = await OAuthGrantEntity.findOne({
    _id: grantId,
    user_id: userId,
  }).lean();
  if (!grant) return false;
  await revokeGrantTokens(grant._id);
  return true;
}
