import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { IS_CLOUD } from "@/config/constants";
import { extractDomainFromInput } from "@/lib/domains";
import { getApplications } from "@/lib/services/applicationService";
import { checkCors } from "../corsCheck";
import {
  getAccount,
  handleErrors,
  jsonResult,
  McpToolContext,
  McpToolError,
} from "../context";
import { getPlanInfo, getProxyBaseUrl } from "../plan";
import { runProxyTest } from "../proxyTest";
import { allowCall } from "../rateLimit";
import { buildSnippet } from "../snippets";

const METHODS = [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
] as const;

const httpUrl = (value: string, field: string): string => {
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    // fall through
  }
  throw new McpToolError(
    `${field} must be a full http(s) URL, e.g. https://api.example.com/data`
  );
};

// The proxy accepts the target URL verbatim, including {{SECRET}} variables,
// which new URL() would percent-encode. Validate without rewriting.
const targetUrl = (value: string): string => {
  const trimmed = value.trim();
  const withoutSecrets = trimmed.replace(/\{\{\s*[A-Za-z0-9_]+\s*\}\}/g, "x");
  httpUrl(withoutSecrets, "url");
  return trimmed;
};

const checkCorsSchema = z.object({
  url: z
    .string()
    .describe(
      "The API URL the browser code calls, e.g. https://api.example.com/data"
    ),
  origin: z
    .string()
    .describe(
      "The website making the request, as an origin, e.g. https://myapp.com or http://localhost:3000"
    ),
  method: z.enum(METHODS).default("GET"),
  headers: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      'Headers the browser code sets, e.g. {"Authorization": "Bearer ...", "Content-Type": "application/json"}. Only used to work out whether a preflight happens; header values are never sent.'
    ),
  credentials: z
    .boolean()
    .default(false)
    .describe(
      "True if the request sends cookies (fetch credentials: 'include')."
    ),
});

const regionSchema = z
  .enum(["auto", "ap", "us", "eu"])
  .default("auto")
  .describe(
    "Proxy region. auto routes to the closest server; ap/us/eu pin a region (Growth and Scale plans)."
  );

const generateSnippetSchema = z.object({
  url: z
    .string()
    .describe(
      "Target API URL. Secrets can be referenced in the query string as {{SECRET_NAME}}."
    ),
  method: z.enum(METHODS).default("GET"),
  headers: z
    .record(z.string(), z.string())
    .optional()
    .describe("Request headers. Secrets can be referenced as {{SECRET_NAME}}."),
  body: z
    .string()
    .optional()
    .describe("Request body as text, e.g. a JSON string."),
  style: z
    .enum(["fetch", "sdk", "sdk-script-tag", "axios", "jquery", "curl"])
    .optional()
    .describe(
      "Code style. Defaults to the Corsfix SDK on the free tier (required there for live websites) and plain fetch otherwise."
    ),
  cache: z
    .string()
    .optional()
    .describe(
      "Cache GET responses on the proxy for a duration such as 10m, 2h or 1d."
    ),
  override_headers: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      "Headers the proxy should send to the target, including ones browsers forbid (Origin, Referer, User-Agent)."
    ),
  region: regionSchema,
});

// Reads (GET, HEAD) and writes (POST, PUT, PATCH, DELETE) are separate tools
// so clients can let reads run freely and ask before anything that could
// change data on the target API.
const proxyTestFields = {
  url: z
    .string()
    .describe(
      "Target API URL. With as_origin set, {{SECRET_NAME}} variables are substituted."
    ),
  headers: z
    .record(z.string(), z.string())
    .optional()
    .describe("Request headers. Secrets can be referenced as {{SECRET_NAME}}."),
  override_headers: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      "Headers the proxy should send to the target, including ones browsers forbid (Origin, Referer, User-Agent)."
    ),
  as_origin: z
    .string()
    .optional()
    .describe(
      "Test as one of your registered origin domains (e.g. myapp.com) to exercise that application's allowed targets, secrets and plan. Leave empty to test like the dashboard playground."
    ),
  use_sdk: z
    .boolean()
    .default(false)
    .describe(
      "Flag the request as Corsfix SDK traffic, as free-tier websites must."
    ),
  region: regionSchema,
};

const testRequestSchema = z.object({
  ...proxyTestFields,
  method: z.enum(["GET", "HEAD"]).default("GET"),
  cache: z
    .string()
    .optional()
    .describe(
      "Cache the response on the proxy for a duration such as 10m (x-corsfix-cache)."
    ),
});

const testWriteRequestSchema = z.object({
  ...proxyTestFields,
  method: z.enum(["POST", "PUT", "PATCH", "DELETE"]),
  body: z
    .string()
    .optional()
    .describe("Request body as text, e.g. a JSON string."),
});

// What both proxy test tools pass to the shared handler.
type ProxyTestArgs = Omit<z.infer<typeof testRequestSchema>, "method"> & {
  method: (typeof METHODS)[number];
  body?: string;
};

async function testThroughProxy(args: ProxyTestArgs, ctx: McpToolContext) {
  const account = await getAccount(ctx);
  if (!(await allowCall(`test:${account.userId}`, 20, 60))) {
    throw new McpToolError(
      "Too many test requests. Wait a minute and try again."
    );
  }
  const plan = await getPlanInfo(account);
  const url = targetUrl(args.url);

  let origin: string;
  if (args.as_origin) {
    const domain = extractDomainFromInput(args.as_origin);
    const applications = await getApplications(account.ownerId);
    const registered = applications.flatMap((app) => app.originDomains ?? []);
    if (!registered.includes(domain)) {
      throw new McpToolError(
        registered.length
          ? `${domain} is not one of your registered origin domains (${registered.join(
              ", "
            )}).`
          : "You have no registered origin domains yet. Create an application first, or leave as_origin empty."
      );
    }
    origin = `https://${domain}`;
  } else {
    // The proxy treats the dashboard's own origin like local development,
    // the same way the playground works.
    origin = account.issuer;
  }

  return jsonResult(
    await runProxyTest({
      url,
      method: args.method,
      headers: args.headers ?? {},
      body: args.body,
      cache: args.cache,
      overrideHeaders: args.override_headers ?? {},
      origin,
      useSdk: args.use_sdk,
      proxyBaseUrl: getProxyBaseUrl(plan, args.region),
    })
  );
}

export function registerDeveloperTools(server: McpServer) {
  server.registerTool(
    "check_cors",
    {
      title: "Check CORS",
      description:
        "Check whether a browser request from a website to an API would be blocked by CORS. Runs the preflight the browser would send (if any) and a GET to the target from Corsfix's servers, then explains the result and how to fix it. Only GET and HEAD are sent for real.",
      inputSchema: checkCorsSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handleErrors(
      "check_cors",
      async (args: z.infer<typeof checkCorsSchema>, ctx) => {
        const account = await getAccount(ctx);
        if (!(await allowCall(`cors:${account.userId}`, 30, 60))) {
          throw new McpToolError(
            "Too many CORS checks. Wait a minute and try again."
          );
        }
        const url = httpUrl(args.url, "url");
        const origin = new URL(httpUrl(args.origin, "origin")).origin;
        const plan = await getPlanInfo(account);
        return jsonResult(
          await checkCors({
            url,
            origin,
            method: args.method,
            headers: args.headers ?? {},
            credentials: args.credentials,
            proxyBaseUrl: getProxyBaseUrl(plan),
          })
        );
      }
    )
  );

  server.registerTool(
    "generate_snippet",
    {
      title: "Generate proxy code",
      description:
        "Generate code that calls an API through the Corsfix CORS proxy: plain fetch, the Corsfix SDK (npm or script tag), axios, jQuery or curl. Uses the right proxy endpoint for the account's plan and adds caching or header overrides when asked.",
      inputSchema: generateSnippetSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    handleErrors(
      "generate_snippet",
      async (args: z.infer<typeof generateSnippetSchema>, ctx) => {
        const account = await getAccount(ctx);
        const plan = await getPlanInfo(account);
        const url = targetUrl(args.url);
        const style = args.style ?? (plan.tier === "free" ? "sdk" : "fetch");
        const proxyBaseUrl = getProxyBaseUrl(plan, args.region);
        const headers = args.headers ?? {};
        const overrideHeaders = args.override_headers ?? {};

        const snippet = buildSnippet({
          url,
          method: args.method,
          headers,
          body: args.body,
          style,
          cache: args.cache,
          overrideHeaders,
          proxyBaseUrl,
          sdkProxyUrl: proxyBaseUrl,
        });

        const notes: string[] = [];
        const usesSecrets = /\{\{\s*[A-Za-z0-9_]+\s*\}\}/.test(
          url + JSON.stringify(headers)
        );
        if (plan.tier === "free" && !style.startsWith("sdk")) {
          notes.push(
            "On the free tier, live websites must call the proxy through the Corsfix SDK; this code works on localhost only until you upgrade."
          );
        }
        if (IS_CLOUD && (!style.startsWith("sdk") || plan.tier !== "free")) {
          notes.push(
            "Register the website's domain as an origin (create_application) before going live. Localhost works without registering."
          );
        }
        if (args.cache && plan.tier === "free") {
          notes.push(
            "Cached responses are not available on the free tier; the proxy ignores the cache option there."
          );
        } else if (args.cache && args.method !== "GET") {
          notes.push("Cached responses only apply to GET requests.");
        }
        if (args.cache && plan.cacheMinimum) {
          notes.push(`Your plan caches for at least ${plan.cacheMinimum}.`);
        }
        if (usesSecrets) {
          notes.push(
            plan.secretsAvailable
              ? "{{SECRET_NAME}} variables are replaced by the proxy for requests from the application's origin domains. Create them with set_secret."
              : "{{SECRET_NAME}} variables need a paid Standard plan or an active trial; on this plan they are sent as-is."
          );
        }
        if (args.region !== "auto" && !plan.regionSelection && IS_CLOUD) {
          notes.push(
            "Region selection is available on Growth and Scale plans."
          );
        }
        if (style === "curl") {
          notes.push(
            "curl is for testing only: the proxy identifies websites by the Origin header, which browsers set automatically."
          );
        }

        return jsonResult({
          style,
          language: snippet.language,
          code: snippet.code,
          proxy_url: proxyBaseUrl,
          notes,
        });
      }
    )
  );

  server.registerTool(
    "test_request",
    {
      title: "Test a request through the proxy",
      description:
        "Send a GET or HEAD request through the Corsfix CORS proxy (https://corsfix.com/docs/cors-proxy/api) and return the status, response headers and the start of the body, like the dashboard playground. Set as_origin to one of your registered origin domains to test that application's allowed targets, secrets and plan. For POST, PUT, PATCH and DELETE requests there is test_write_request.",
      inputSchema: testRequestSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handleErrors(
      "test_request",
      (args: z.infer<typeof testRequestSchema>, ctx) =>
        testThroughProxy(args, ctx)
    )
  );

  server.registerTool(
    "test_write_request",
    {
      title: "Send a write request through the proxy",
      description:
        "Send a POST, PUT, PATCH or DELETE request with an optional body through the Corsfix CORS proxy (https://corsfix.com/docs/cors-proxy/api) and return the status, response headers and the start of the body. The request reaches the target API for real, so it can create, change or delete data there. Set as_origin to one of your registered origin domains to test that application's allowed targets, secrets and plan.",
      inputSchema: testWriteRequestSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    handleErrors(
      "test_write_request",
      (args: z.infer<typeof testWriteRequestSchema>, ctx) =>
        testThroughProxy(args, ctx)
    )
  );
}
