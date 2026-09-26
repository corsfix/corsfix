import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getIssuerFromRequest,
  getRequestOrigin,
  REGISTERED_CLIENT_TTL_SECONDS,
} from "@/lib/oauth/config";
import {
  buildRedirectUrl,
  readAuthorizationParams,
  validateAuthorizationRequest,
} from "@/lib/oauth/authorizationRequest";
import { touchRegisteredClient } from "@/lib/oauth/clientService";
import { createAuthorizationCode } from "@/lib/oauth/tokenService";

export const dynamic = "force-dynamic";

// Receives the Allow / Cancel decision from the consent page
// (/oauth/authorize) and sends the browser back to the MCP client.
export async function POST(req: Request) {
  const issuer = getIssuerFromRequest(req);

  // Only the consent page on this site may submit a decision. The session
  // cookie is SameSite=Lax as well, so a cross-site form post arrives without
  // a session either way.
  const origin = req.headers.get("origin");
  const sameOrigin = origin
    ? origin === issuer || origin === getRequestOrigin(req)
    : req.headers.get("sec-fetch-site") === "same-origin";
  if (!sameOrigin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const form = await req.formData();
  const params = readAuthorizationParams(form);
  const consentPage = new URL("/oauth/consent", issuer);
  for (const [key, value] of Object.entries(params)) {
    if (value) consentPage.searchParams.set(key, value);
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.redirect(consentPage, 303);
  }

  const result = await validateAuthorizationRequest(params, issuer);
  if (!result.ok) {
    if (!result.redirectUri) {
      // The consent page explains errors that cannot be sent to the client.
      return NextResponse.redirect(consentPage, 303);
    }
    return NextResponse.redirect(
      buildRedirectUrl(result.redirectUri, issuer, {
        error: result.error,
        error_description: result.description,
        state: result.state,
      }),
      303
    );
  }

  const { request } = result;

  if (form.get("decision") !== "approve") {
    return NextResponse.redirect(
      buildRedirectUrl(request.redirectUri, issuer, {
        error: "access_denied",
        error_description: "The user declined to connect the app.",
        state: request.state,
      }),
      303
    );
  }

  const code = await createAuthorizationCode({
    client: request.client,
    userId,
    redirectUri: request.redirectUri,
    codeChallenge: request.codeChallenge,
    scope: request.scope,
    resource: request.resource,
  });
  await touchRegisteredClient(request.client, REGISTERED_CLIENT_TTL_SECONDS);

  return NextResponse.redirect(
    buildRedirectUrl(request.redirectUri, issuer, {
      code,
      state: request.state,
    }),
    303
  );
}
