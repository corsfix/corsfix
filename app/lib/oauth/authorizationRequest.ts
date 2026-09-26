import {
  OAUTH_SCOPE,
  OFFLINE_ACCESS_SCOPE,
  canonicalizeResource,
} from "./config";
import { isValidCodeChallenge } from "./crypto";
import { OAuthClient, OAuthClientError, getClient } from "./clientService";
import { redirectUriMatches } from "./redirectUri";

export interface AuthorizationParams {
  client_id?: string;
  redirect_uri?: string;
  response_type?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  scope?: string;
  state?: string;
  resource?: string;
}

export const AUTHORIZATION_PARAM_NAMES: (keyof AuthorizationParams)[] = [
  "client_id",
  "redirect_uri",
  "response_type",
  "code_challenge",
  "code_challenge_method",
  "scope",
  "state",
  "resource",
];

export interface ValidAuthorizationRequest {
  client: OAuthClient;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  resource: string;
  state?: string;
}

export type AuthorizationRequestResult =
  | { ok: true; request: ValidAuthorizationRequest }
  // The client or redirect URI cannot be trusted: show the error, never redirect.
  | { ok: false; redirectUri: null; error: string; description: string }
  // Everything else is reported back to the client through its redirect URI.
  | {
      ok: false;
      redirectUri: string;
      state?: string;
      error: string;
      description: string;
    };

export const readAuthorizationParams = (
  source: URLSearchParams | FormData
): AuthorizationParams => {
  const params: AuthorizationParams = {};
  for (const name of AUTHORIZATION_PARAM_NAMES) {
    const value = source.get(name);
    if (typeof value === "string" && value.length > 0) {
      params[name] = value;
    }
  }
  return params;
};

// Adds query parameters to a client redirect URI (https, loopback or a
// native app scheme), always including the issuer (RFC 9207).
export const buildRedirectUrl = (
  redirectUri: string,
  issuer: string,
  params: Record<string, string | undefined>
): string => {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  url.searchParams.set("iss", issuer);
  return url.toString();
};

export async function validateAuthorizationRequest(
  params: AuthorizationParams,
  issuer: string
): Promise<AuthorizationRequestResult> {
  const fail = (error: string, description: string) =>
    ({ ok: false, redirectUri: null, error, description } as const);

  if (!params.client_id) {
    return fail("invalid_request", "The request is missing client_id.");
  }

  let client: OAuthClient | null;
  try {
    client = await getClient(params.client_id);
  } catch (error) {
    return fail(
      "invalid_client",
      error instanceof OAuthClientError
        ? error.message
        : "The client could not be verified."
    );
  }
  if (!client) {
    return fail(
      "invalid_client",
      "This app is not registered with Corsfix. Try connecting it again from the app."
    );
  }

  let redirectUri: string | undefined;
  if (params.redirect_uri) {
    if (
      client.redirect_uris.some((registered) =>
        redirectUriMatches(registered, params.redirect_uri!)
      )
    ) {
      redirectUri = params.redirect_uri;
    }
  } else if (client.redirect_uris.length === 1) {
    redirectUri = client.redirect_uris[0];
  }
  if (!redirectUri) {
    return fail(
      "invalid_request",
      "The redirect_uri does not match any redirect URI registered for this app."
    );
  }

  const state = params.state;
  const redirectError = (error: string, description: string) =>
    ({
      ok: false,
      redirectUri: redirectUri!,
      state,
      error,
      description,
    } as const);

  if (state && state.length > 2048) {
    return redirectError("invalid_request", "state is too long.");
  }
  if (params.response_type !== "code") {
    return redirectError(
      "unsupported_response_type",
      "Only response_type=code is supported."
    );
  }
  if (!params.code_challenge || params.code_challenge_method !== "S256") {
    return redirectError(
      "invalid_request",
      "PKCE is required: send code_challenge with code_challenge_method=S256."
    );
  }
  if (!isValidCodeChallenge(params.code_challenge)) {
    return redirectError("invalid_request", "code_challenge is malformed.");
  }

  const resource = canonicalizeResource(params.resource, issuer);
  if (!resource) {
    return redirectError(
      "invalid_target",
      `The resource must be this server's MCP endpoint (${issuer}/mcp).`
    );
  }

  // One scope covers everything the MCP server can do, and it is always
  // granted. offline_access is echoed back when requested; other scopes are
  // ignored.
  const requestedScopes = (params.scope ?? "").split(" ");
  const scope = requestedScopes.includes(OFFLINE_ACCESS_SCOPE)
    ? `${OAUTH_SCOPE} ${OFFLINE_ACCESS_SCOPE}`
    : OAUTH_SCOPE;

  return {
    ok: true,
    request: {
      client,
      redirectUri,
      codeChallenge: params.code_challenge,
      scope,
      resource,
      state,
    },
  };
}
