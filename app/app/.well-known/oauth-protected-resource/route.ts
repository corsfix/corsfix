import { getIssuerFromRequest } from "@/lib/oauth/config";
import { oauthJson, preflightResponse } from "@/lib/oauth/http";
import { protectedResourceMetadata } from "@/lib/oauth/metadata";

export const dynamic = "force-dynamic";

// Served both here and at /.well-known/oauth-protected-resource/mcp, the two
// locations MCP clients probe for the /mcp endpoint's metadata.
export function GET(req: Request) {
  return oauthJson(protectedResourceMetadata(getIssuerFromRequest(req)), 200, {
    "Cache-Control": "public, max-age=3600",
  });
}

export function OPTIONS() {
  return preflightResponse();
}
