import { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Check, ExternalLink } from "lucide-react";
import { auth } from "@/auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { getIssuer } from "@/lib/oauth/config";
import {
  AUTHORIZATION_PARAM_NAMES,
  buildRedirectUrl,
  readAuthorizationParams,
  validateAuthorizationRequest,
} from "@/lib/oauth/authorizationRequest";
import {
  isLoopbackRedirect,
  redirectDisplayTarget,
} from "@/lib/oauth/redirectUri";

export const metadata: Metadata = {
  title: "Connect an app | Corsfix Dashboard",
};

export const dynamic = "force-dynamic";

const PERMISSIONS = [
  "See your applications, their domains, secret names and usage metrics",
  "Create, update and delete applications",
  "Add, update and delete secrets (existing secret values stay hidden)",
  "Check URLs for CORS support and send test requests through the proxy",
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border bg-card text-card-foreground shadow p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Logo className="size-8" />
          <span className="text-lg font-medium">Corsfix</span>
        </div>
        {children}
      </div>
    </div>
  );
}

const hostOf = (value?: string) => {
  if (!value) return undefined;
  try {
    return new URL(value).host;
  } catch {
    return undefined;
  }
};

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") query.set(key, value);
  }
  const params = readAuthorizationParams(query);

  const session = await auth();
  if (!session?.user?.id) {
    // The dashboard's sign-in dialog opens over this page and brings the user
    // back here afterwards.
    return (
      <Shell>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Sign in to connect an app</h1>
          <p className="text-sm text-muted-foreground">
            An app is asking to connect to your Corsfix account. Sign in to
            review the request.
          </p>
        </div>
      </Shell>
    );
  }

  const issuer = getIssuer(await headers());
  const result = await validateAuthorizationRequest(params, issuer);

  if (!result.ok) {
    if (result.redirectUri) {
      redirect(
        buildRedirectUrl(result.redirectUri, issuer, {
          error: result.error,
          error_description: result.description,
          state: result.state,
        })
      );
    }
    return (
      <Shell>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">
            This request can&apos;t be completed
          </h1>
          <p className="text-sm text-muted-foreground">{result.description}</p>
        </div>
        <Button asChild variant="secondary" className="w-full">
          <Link href="/get-started">Go to the dashboard</Link>
        </Button>
      </Shell>
    );
  }

  const { client, redirectUri } = result.request;
  const redirectTarget = redirectDisplayTarget(redirectUri);
  const clientSite =
    client.source === "metadata_document"
      ? hostOf(client.client_id)
      : hostOf(client.client_uri);
  let localRedirect = false;
  try {
    localRedirect = isLoopbackRedirect(new URL(redirectUri));
  } catch {
    localRedirect = false;
  }
  // A metadata document is self-published, so the site hosting it is what
  // identifies the app; the name is whatever the document says.
  const verifiedSite =
    client.source === "metadata_document" ? clientSite : undefined;
  const warning = localRedirect
    ? "This app receives the approval on your own computer."
    : client.source === "registered"
    ? "Corsfix can't verify who made this app."
    : redirectTarget !== verifiedSite
    ? `This app is published by ${verifiedSite} but sends you back to ${redirectTarget}.`
    : null;

  return (
    <Shell>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold leading-snug">
          Allow {client.client_name}
          {verifiedSite ? ` (${verifiedSite})` : ""} to use your Corsfix
          account?
        </h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {session.user.email ?? "your account"}.
        </p>
      </div>

      <dl className="text-sm rounded-lg border divide-y">
        <div className="flex justify-between gap-4 px-3 py-2">
          <dt className="text-muted-foreground">App</dt>
          <dd className="text-right font-medium break-all">
            {client.client_name}
          </dd>
        </div>
        <div className="flex justify-between gap-4 px-3 py-2">
          <dt className="text-muted-foreground">
            {client.source === "metadata_document" ? "Published by" : "Website"}
          </dt>
          <dd className="text-right break-all">
            {clientSite ?? "Not provided"}
          </dd>
        </div>
        <div className="flex justify-between gap-4 px-3 py-2">
          <dt className="text-muted-foreground">Sends you back to</dt>
          <dd className="text-right font-mono text-xs break-all">
            {redirectTarget}
          </dd>
        </div>
      </dl>

      <div className="space-y-2">
        <p className="text-sm font-medium">It will be able to:</p>
        <ul className="space-y-1.5 text-sm">
          {PERMISSIONS.map((permission) => (
            <li key={permission} className="flex gap-2">
              <Check className="size-4 mt-0.5 shrink-0 text-violet-500" />
              <span>{permission}</span>
            </li>
          ))}
        </ul>
      </div>

      {warning && (
        <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-500" />
          <p>
            {warning} Only allow it if you just started connecting Corsfix from
            an app you trust.
          </p>
        </div>
      )}

      <form method="post" action="/api/oauth/authorize" className="flex gap-2">
        {AUTHORIZATION_PARAM_NAMES.map((name) =>
          params[name] ? (
            <input key={name} type="hidden" name={name} value={params[name]} />
          ) : null
        )}
        <Button
          type="submit"
          name="decision"
          value="deny"
          variant="outline"
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          name="decision"
          value="approve"
          className="flex-1"
          data-umami-event="mcp-oauth-approve"
        >
          Allow
        </Button>
      </form>

      <p className="text-xs text-muted-foreground">
        You can disconnect apps at any time from the{" "}
        <Link href="/mcp-setup" className="underline">
          MCP page
        </Link>{" "}
        of your dashboard.{" "}
        <a
          href="https://corsfix.com/docs/mcp"
          target="_blank"
          className="underline inline-flex items-center gap-0.5"
        >
          Learn more <ExternalLink className="size-3" />
        </a>
      </p>
    </Shell>
  );
}
