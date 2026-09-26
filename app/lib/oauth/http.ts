import { NextResponse } from "next/server";
import { OAuthClient, OAuthClientError, getClient } from "./clientService";
import { hashToken, safeEqual } from "./crypto";
import { OAuthTokenError } from "./tokenService";

// OAuth endpoints are called by MCP clients, some of which run in a browser
// (for example the MCP Inspector), so they allow any origin. They never rely
// on cookies, so this does not expose anything to other sites.
export const PUBLIC_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

const NO_STORE = {
  "Cache-Control": "no-store",
  Pragma: "no-cache",
};

export const preflightResponse = () =>
  new NextResponse(null, { status: 204, headers: PUBLIC_CORS_HEADERS });

// Responses are not cached unless the caller sets its own Cache-Control
// (the public metadata documents do).
export const oauthJson = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
) =>
  NextResponse.json(body, {
    status,
    headers: {
      ...PUBLIC_CORS_HEADERS,
      ...(headers["Cache-Control"] ? {} : NO_STORE),
      ...headers,
    },
  });

export const oauthErrorResponse = (error: OAuthTokenError) =>
  oauthJson(
    { error: error.error, error_description: error.description },
    error.status,
    error.status === 401 ? { "WWW-Authenticate": 'Basic realm="corsfix"' } : {}
  );

// Token and revocation requests are form encoded (RFC 6749). JSON bodies are
// accepted too, since a few clients send them.
export async function readFormBody(req: Request): Promise<URLSearchParams> {
  const contentType = req.headers.get("content-type") || "";
  const text = await req.text();
  if (text.length > 16 * 1024) {
    throw new OAuthTokenError(
      "invalid_request",
      "The request body is too large."
    );
  }
  if (contentType.includes("application/json")) {
    try {
      const json = JSON.parse(text);
      const params = new URLSearchParams();
      if (json && typeof json === "object") {
        for (const [key, value] of Object.entries(json)) {
          if (typeof value === "string") params.set(key, value);
        }
      }
      return params;
    } catch {
      throw new OAuthTokenError(
        "invalid_request",
        "The request body is not valid JSON."
      );
    }
  }
  return new URLSearchParams(text);
}

const invalidClient = (description: string, usedBasic: boolean) =>
  new OAuthTokenError("invalid_client", description, usedBasic ? 401 : 400);

// Client authentication at the token and revocation endpoints: public clients
// (token_endpoint_auth_method "none") send only client_id; clients registered
// with a secret send it with HTTP Basic or in the body.
export async function authenticateClient(
  req: Request,
  params: URLSearchParams
): Promise<OAuthClient> {
  let clientId = params.get("client_id") || undefined;
  let clientSecret = params.get("client_secret") || undefined;
  let usedBasic = false;

  const header = req.headers.get("authorization");
  if (header?.toLowerCase().startsWith("basic ")) {
    const decoded = Buffer.from(header.slice(6).trim(), "base64").toString(
      "utf8"
    );
    const separator = decoded.indexOf(":");
    let basicId: string;
    let basicSecret: string;
    try {
      if (separator < 0) throw new URIError();
      basicId = decodeURIComponent(decoded.slice(0, separator));
      basicSecret = decodeURIComponent(decoded.slice(separator + 1));
    } catch {
      throw invalidClient("Malformed Basic authorization header.", true);
    }
    if (clientId && clientId !== basicId) {
      throw invalidClient(
        "client_id does not match the Basic credentials.",
        true
      );
    }
    clientId = basicId;
    clientSecret = basicSecret;
    usedBasic = true;
  }

  if (!clientId) {
    throw invalidClient("client_id is required.", usedBasic);
  }

  let client: OAuthClient | null;
  try {
    client = await getClient(clientId, { fetchMetadata: false });
  } catch (error) {
    throw invalidClient(
      error instanceof OAuthClientError ? error.message : "Unknown client.",
      usedBasic
    );
  }
  if (!client) {
    throw invalidClient(
      "Unknown client. Register the client again.",
      usedBasic
    );
  }

  if (client.token_endpoint_auth_method === "none") {
    return client;
  }

  if (
    !clientSecret ||
    !client.client_secret_hash ||
    !safeEqual(hashToken(clientSecret), client.client_secret_hash)
  ) {
    throw invalidClient("Client authentication failed.", usedBasic);
  }
  return client;
}

export const getClientIp = (req: Request): string =>
  req.headers.get("x-real-ip") ||
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
  "unknown";
