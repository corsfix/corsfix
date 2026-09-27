import { NextResponse } from "next/server";
import { getIssuerFromRequest } from "@/lib/oauth/config";
import {
  AUTHORIZATION_PARAM_NAMES,
  readAuthorizationParams,
} from "@/lib/oauth/authorizationRequest";

export const dynamic = "force-dynamic";

// OAuth 2.1 authorization endpoint. It only forwards the request to the
// consent page, which asks the user to sign in if needed, checks the request
// and shows the app. Errors are never redirected to the client
// automatically: anyone can register a client, so its redirect URI is not
// trusted enough to send users there without a click (RFC 9700 4.11.1).
export async function GET(req: Request) {
  const issuer = getIssuerFromRequest(req);
  const params = readAuthorizationParams(new URL(req.url).searchParams);

  const consentPage = new URL("/oauth/consent", issuer);
  for (const name of AUTHORIZATION_PARAM_NAMES) {
    const value = params[name];
    if (value) consentPage.searchParams.set(name, value);
  }
  return NextResponse.redirect(consentPage, 302);
}
