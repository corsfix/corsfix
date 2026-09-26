// OAuth 2.1 authorization server settings for MCP clients.
//
// The dashboard is both the authorization server (issuer) and the protected
// resource: the MCP endpoint lives at `${issuer}/mcp` and only accepts access
// tokens issued for that exact resource.

export const OAUTH_SCOPE = "corsfix";
// Refresh tokens are always issued. offline_access is listed and granted when
// asked for because some clients (ChatGPT, for one) only keep refresh tokens
// when the server supports it.
export const OFFLINE_ACCESS_SCOPE = "offline_access";
export const SCOPES_SUPPORTED = [OAUTH_SCOPE, OFFLINE_ACCESS_SCOPE];

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
// A rotated refresh token presented again within this window is treated as a
// concurrent refresh, not as a stolen token.
export const REFRESH_TOKEN_REUSE_GRACE_SECONDS = 30;
export const AUTHORIZATION_CODE_TTL_SECONDS = 10 * 60; // 10 minutes
export const REGISTERED_CLIENT_TTL_SECONDS = 90 * 24 * 60 * 60; // unused clients expire after 90 days

export const MCP_PATH = "/mcp";
export const PROTECTED_RESOURCE_METADATA_PATH =
  "/.well-known/oauth-protected-resource/mcp";

const originFromUrl = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const originFromHeaders = (headers: Headers, fallbackUrl?: string): string => {
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0].trim();
  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const host = forwardedHost || headers.get("host");
  if (host) {
    const proto =
      forwardedProto ||
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");
    return new URL(`${proto}://${host}`).origin;
  }
  if (fallbackUrl) return new URL(fallbackUrl).origin;
  throw new Error("Unable to determine the dashboard URL");
};

// The issuer is the public origin of the dashboard. AUTH_URL (already used by
// Auth.js and set in the self-hosting compose file) wins over request headers
// so the issuer stays stable no matter how a request reached the app.
export const getIssuer = (headers: Headers, requestUrl?: string): string =>
  originFromUrl(process.env.AUTH_URL) ||
  originFromUrl(process.env.NEXTAUTH_URL) ||
  originFromHeaders(headers, requestUrl);

export const getIssuerFromRequest = (req: Request): string =>
  getIssuer(req.headers, req.url);

// The origin the browser used to reach the dashboard, ignoring AUTH_URL.
export const getRequestOrigin = (req: Request): string =>
  originFromHeaders(req.headers, req.url);

export const getMcpResource = (issuer: string): string =>
  `${issuer}${MCP_PATH}`;

// RFC 8707 resource indicators. Accepts the MCP endpoint URL or the bare
// dashboard origin (some clients send the server origin), in any letter case
// and with or without a trailing slash, and maps both to the canonical MCP
// resource. Anything else is rejected.
export const canonicalizeResource = (
  value: string | null | undefined,
  issuer: string
): string | null => {
  const canonical = getMcpResource(issuer);
  if (!value) return canonical;
  try {
    const url = new URL(value);
    if (url.hash) return null;
    const path = url.pathname.replace(/\/+$/, "");
    if (url.origin !== issuer || url.search) return null;
    if (path === "" || path === MCP_PATH) return canonical;
    return null;
  } catch {
    return null;
  }
};
