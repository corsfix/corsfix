import {
  canonicalizeResource,
  getIssuerFromRequest,
  REGISTERED_CLIENT_TTL_SECONDS,
} from "@/lib/oauth/config";
import { touchRegisteredClient } from "@/lib/oauth/clientService";
import {
  authenticateClient,
  oauthErrorResponse,
  oauthJson,
  preflightResponse,
  readFormBody,
} from "@/lib/oauth/http";
import {
  OAuthTokenError,
  exchangeAuthorizationCode,
  refreshTokens,
} from "@/lib/oauth/tokenService";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const params = await readFormBody(req);
    const client = await authenticateClient(req, params);
    const issuer = getIssuerFromRequest(req);

    const requestedResource = params.get("resource");
    const resource = requestedResource
      ? canonicalizeResource(requestedResource, issuer)
      : null;
    if (requestedResource && !resource) {
      throw new OAuthTokenError(
        "invalid_target",
        `The resource must be this server's MCP endpoint (${issuer}/mcp).`
      );
    }

    const grantType = params.get("grant_type");
    let response;

    if (grantType === "authorization_code") {
      const code = params.get("code");
      const codeVerifier = params.get("code_verifier");
      if (!code || !codeVerifier) {
        throw new OAuthTokenError(
          "invalid_request",
          "code and code_verifier are required."
        );
      }
      response = await exchangeAuthorizationCode({
        client,
        code,
        codeVerifier,
        redirectUri: params.get("redirect_uri") || undefined,
        resource,
      });
    } else if (grantType === "refresh_token") {
      const refreshToken = params.get("refresh_token");
      if (!refreshToken) {
        throw new OAuthTokenError(
          "invalid_request",
          "refresh_token is required."
        );
      }
      response = await refreshTokens({ client, refreshToken, resource });
    } else {
      throw new OAuthTokenError(
        "unsupported_grant_type",
        "Supported grant types are authorization_code and refresh_token."
      );
    }

    await touchRegisteredClient(client, REGISTERED_CLIENT_TTL_SECONDS);
    return oauthJson(response);
  } catch (error) {
    if (error instanceof OAuthTokenError) {
      return oauthErrorResponse(error);
    }
    console.error("OAuth token request failed", error);
    return oauthJson(
      { error: "server_error", error_description: "Unexpected error." },
      500
    );
  }
}

export function OPTIONS() {
  return preflightResponse();
}
