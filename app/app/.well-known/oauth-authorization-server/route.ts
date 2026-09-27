import { getIssuerFromRequest, isIssuerConfigured } from "@/lib/oauth/config";
import { oauthJson, preflightResponse } from "@/lib/oauth/http";
import { authorizationServerMetadata } from "@/lib/oauth/metadata";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return oauthJson(
    authorizationServerMetadata(getIssuerFromRequest(req)),
    200,
    {
      "Cache-Control": isIssuerConfigured()
        ? "public, max-age=3600"
        : "no-store",
    }
  );
}

export function OPTIONS() {
  return preflightResponse();
}
