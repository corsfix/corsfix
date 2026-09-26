import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getIssuerFromRequest } from "@/lib/oauth/config";
import {
  AUTHORIZATION_PARAM_NAMES,
  buildRedirectUrl,
  readAuthorizationParams,
  validateAuthorizationRequest,
} from "@/lib/oauth/authorizationRequest";

export const dynamic = "force-dynamic";

// OAuth 2.1 authorization endpoint. Errors that can be reported to the client
// are sent back to its redirect URI with a real HTTP redirect; everything
// else continues to the consent page, which asks the user to sign in if
// needed and to allow or cancel.
export async function GET(req: Request) {
  const issuer = getIssuerFromRequest(req);
  const params = readAuthorizationParams(new URL(req.url).searchParams);

  const consentPage = new URL("/oauth/consent", issuer);
  for (const name of AUTHORIZATION_PARAM_NAMES) {
    const value = params[name];
    if (value) consentPage.searchParams.set(name, value);
  }

  // Client metadata documents are only fetched for signed-in users.
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(consentPage, 302);
  }

  const result = await validateAuthorizationRequest(params, issuer);
  if (!result.ok && result.redirectUri) {
    return NextResponse.redirect(
      buildRedirectUrl(result.redirectUri, issuer, {
        error: result.error,
        error_description: result.description,
        state: result.state,
      }),
      302
    );
  }

  return NextResponse.redirect(consentPage, 302);
}
