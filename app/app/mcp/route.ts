import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/server";
import {
  OAUTH_SCOPE,
  PROTECTED_RESOURCE_METADATA_PATH,
  getIssuerFromRequest,
  getMcpResource,
} from "@/lib/oauth/config";
import { verifyAccessToken } from "@/lib/oauth/tokenService";
import {
  SERVER_INFO,
  SERVER_INSTRUCTIONS,
  registerCorsfixTools,
} from "@/lib/mcp/server";

export const dynamic = "force-dynamic";

// Remote MCP server (Streamable HTTP). Every request needs an OAuth access
// token issued by this dashboard for this exact endpoint; unauthenticated
// requests get a 401 pointing to the protected resource metadata, which MCP
// clients use to start the sign-in flow.

const mcpHandler = createMcpHandler(registerCorsfixTools, {
  serverInfo: SERVER_INFO,
  instructions: SERVER_INSTRUCTIONS,
});

// MCP clients authenticate with bearer tokens, never cookies, so allowing any
// origin lets browser-based clients connect without exposing anything.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers":
    "WWW-Authenticate, Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

async function handleMcpRequest(req: Request): Promise<Response> {
  const issuer = getIssuerFromRequest(req);
  const resource = getMcpResource(issuer);

  const verifyToken = async (
    _req: Request,
    bearerToken?: string
  ): Promise<AuthInfo | undefined> => {
    if (!bearerToken) return undefined;
    const token = await verifyAccessToken(bearerToken, resource);
    if (!token) return undefined;
    return {
      token: bearerToken,
      clientId: token.clientId,
      scopes: token.scopes,
      expiresAt: token.expiresAt,
      resource: new URL(token.resource),
      extra: { userId: token.userId, grantId: token.grantId, issuer },
    };
  };

  const authenticated = withMcpAuth(mcpHandler, verifyToken, {
    required: true,
    requiredScopes: [OAUTH_SCOPE],
    resourceMetadataPath: PROTECTED_RESOURCE_METADATA_PATH,
    resourceUrl: issuer,
  });

  const response = await authenticated(req);
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export {
  handleMcpRequest as GET,
  handleMcpRequest as POST,
  handleMcpRequest as DELETE,
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
