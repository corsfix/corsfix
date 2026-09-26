import {
  authenticateClient,
  oauthErrorResponse,
  oauthJson,
  preflightResponse,
  readFormBody,
} from "@/lib/oauth/http";
import { OAuthTokenError, revokeToken } from "@/lib/oauth/tokenService";

export const dynamic = "force-dynamic";

// OAuth 2.0 Token Revocation (RFC 7009).
export async function POST(req: Request) {
  try {
    const params = await readFormBody(req);
    const client = await authenticateClient(req, params);
    const token = params.get("token");
    if (!token) {
      throw new OAuthTokenError("invalid_request", "token is required.");
    }
    await revokeToken(token, client.client_id);
    return oauthJson({});
  } catch (error) {
    if (error instanceof OAuthTokenError) {
      return oauthErrorResponse(error);
    }
    console.error("OAuth revocation failed", error);
    return oauthJson(
      { error: "server_error", error_description: "Unexpected error." },
      500
    );
  }
}

export function OPTIONS() {
  return preflightResponse();
}
