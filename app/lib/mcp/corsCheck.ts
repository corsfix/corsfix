import { safeFetch, SafeFetchError, SafeFetchResponse } from "@/lib/safeFetch";

// Reproduces the browser's CORS checks (Fetch standard) against a live URL,
// so an agent can tell whether a request will be blocked before suggesting
// a proxy.

const SAFELISTED_HEADERS = new Set([
  "accept",
  "accept-language",
  "content-language",
  "content-type",
  "range",
]);
const SIMPLE_CONTENT_TYPES = new Set([
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "text/plain",
]);
const SIMPLE_METHODS = new Set(["GET", "HEAD", "POST"]);

// Headers browsers set themselves; listing them does not trigger a preflight.
const BROWSER_MANAGED_HEADERS = new Set([
  "origin",
  "referer",
  "user-agent",
  "host",
  "cookie",
  "connection",
  "content-length",
  "accept-encoding",
]);

export interface RequestShape {
  needsPreflight: boolean;
  reasons: string[];
  // Lowercased names the browser lists in Access-Control-Request-Headers.
  unsafeHeaders: string[];
}

export function analyzeRequest(
  method: string,
  headers: Record<string, string>
): RequestShape {
  const reasons: string[] = [];
  const unsafeHeaders = new Set<string>();

  if (!SIMPLE_METHODS.has(method)) {
    reasons.push(
      `${method} is not a simple method (only GET, HEAD and POST are)`
    );
  }

  for (const [rawName, value] of Object.entries(headers)) {
    const name = rawName.toLowerCase();
    if (BROWSER_MANAGED_HEADERS.has(name)) continue;
    if (!SAFELISTED_HEADERS.has(name)) {
      unsafeHeaders.add(name);
      reasons.push(`the ${rawName} header is not CORS-safelisted`);
    } else if (
      name === "content-type" &&
      !SIMPLE_CONTENT_TYPES.has(value.split(";")[0].trim().toLowerCase())
    ) {
      unsafeHeaders.add(name);
      reasons.push(
        `Content-Type ${value} is not one of the simple content types`
      );
    } else if (name === "range" && !/^bytes=\d+-\d*$/.test(value.trim())) {
      unsafeHeaders.add(name);
      reasons.push("the Range header is not a simple byte range");
    }
  }

  return {
    needsPreflight: reasons.length > 0,
    reasons,
    unsafeHeaders: [...unsafeHeaders].sort(),
  };
}

const splitList = (value?: string) =>
  (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const corsHeaders = (response: SafeFetchResponse) => {
  const picked: Record<string, string> = {};
  for (const [name, value] of Object.entries(response.headers)) {
    if (name.startsWith("access-control-") || name === "vary") {
      picked[name] = value;
    }
  }
  return picked;
};

function checkAllowOrigin(
  response: SafeFetchResponse,
  origin: string,
  credentials: boolean
): string[] {
  const problems: string[] = [];
  const allowOrigin = response.headers["access-control-allow-origin"];

  if (!allowOrigin) {
    problems.push("The response has no Access-Control-Allow-Origin header.");
  } else if (allowOrigin === "*") {
    if (credentials) {
      problems.push(
        "Access-Control-Allow-Origin is *, which browsers refuse for requests that send credentials."
      );
    }
  } else if (allowOrigin !== origin) {
    problems.push(
      `Access-Control-Allow-Origin is ${allowOrigin}, which does not match ${origin}.`
    );
  }

  if (
    credentials &&
    response.headers["access-control-allow-credentials"] !== "true"
  ) {
    problems.push(
      "The request sends credentials but Access-Control-Allow-Credentials is not true."
    );
  }
  return problems;
}

export function evaluatePreflight(
  response: SafeFetchResponse,
  {
    origin,
    method,
    unsafeHeaders,
    credentials,
  }: {
    origin: string;
    method: string;
    unsafeHeaders: string[];
    credentials: boolean;
  }
): string[] {
  const problems: string[] = [];

  if (response.status >= 300 && response.status < 400) {
    problems.push(
      `The preflight got a ${response.status} redirect. Browsers do not follow redirects for preflight requests.`
    );
  } else if (response.status < 200 || response.status >= 300) {
    problems.push(
      `The preflight (OPTIONS) request returned ${response.status}; browsers need a 2xx status.`
    );
  }

  problems.push(...checkAllowOrigin(response, origin, credentials));

  if (!SIMPLE_METHODS.has(method)) {
    const allowed = splitList(response.headers["access-control-allow-methods"]);
    const wildcard = allowed.includes("*") && !credentials;
    if (!wildcard && !allowed.map((m) => m.toUpperCase()).includes(method)) {
      problems.push(
        `Access-Control-Allow-Methods (${
          allowed.join(", ") || "missing"
        }) does not include ${method}.`
      );
    }
  }

  const allowedHeaders = splitList(
    response.headers["access-control-allow-headers"]
  ).map((header) => header.toLowerCase());
  const headerWildcard = allowedHeaders.includes("*") && !credentials;
  for (const header of unsafeHeaders) {
    // "*" never covers Authorization.
    const covered =
      allowedHeaders.includes(header) ||
      (headerWildcard && header !== "authorization");
    if (!covered) {
      problems.push(
        `Access-Control-Allow-Headers (${
          allowedHeaders.join(", ") || "missing"
        }) does not include ${header}.`
      );
    }
  }

  return problems;
}

export interface CorsCheckInput {
  url: string;
  origin: string;
  method: string;
  headers: Record<string, string>;
  credentials: boolean;
  // Proxy base URL suggested in the fix, e.g. https://proxy.corsfix.com
  proxyBaseUrl: string;
}

export async function checkCors(input: CorsCheckInput) {
  const method = input.method.toUpperCase();
  const shape = analyzeRequest(method, input.headers);
  const result: Record<string, unknown> = {
    request: {
      url: input.url,
      origin: input.origin,
      method,
      credentials: input.credentials,
    },
  };
  const problems: string[] = [];

  try {
    if (shape.needsPreflight) {
      const preflight = await safeFetch(input.url, {
        method: "OPTIONS",
        headers: {
          origin: input.origin,
          "access-control-request-method": method,
          ...(shape.unsafeHeaders.length
            ? {
                "access-control-request-headers": shape.unsafeHeaders.join(","),
              }
            : {}),
        },
        maxBytes: 4 * 1024,
      });
      const preflightProblems = evaluatePreflight(preflight, {
        origin: input.origin,
        method,
        unsafeHeaders: shape.unsafeHeaders,
        credentials: input.credentials,
      });
      problems.push(...preflightProblems);
      result.preflight = {
        required: true,
        why: shape.reasons,
        status: preflight.status,
        cors_headers: corsHeaders(preflight),
        passes: preflightProblems.length === 0,
      };
    } else {
      result.preflight = {
        required: false,
        why: [
          "simple request: GET/HEAD/POST with only CORS-safelisted headers",
        ],
      };
    }

    // Only GET and HEAD are sent for real; other methods could change data
    // on the target, so a GET to the same URL stands in for them.
    const probeMethod = method === "HEAD" ? "HEAD" : "GET";
    const response = await safeFetch(input.url, {
      method: probeMethod,
      headers: { origin: input.origin },
      maxBytes: 4 * 1024,
    });
    const responseProblems = checkAllowOrigin(
      response,
      input.origin,
      input.credentials
    );
    problems.push(...responseProblems);
    result.response = {
      method_checked: probeMethod,
      ...(probeMethod !== method
        ? {
            note: `${method} was not sent to avoid side effects; the GET response's CORS headers usually match.`,
          }
        : {}),
      status: response.status,
      cors_headers: corsHeaders(response),
      passes: responseProblems.length === 0,
    };
  } catch (error) {
    if (error instanceof SafeFetchError || error instanceof Error) {
      return {
        ...result,
        verdict: "unknown",
        summary: `Could not reach ${input.url}: ${error.message}`,
      };
    }
    throw error;
  }

  const blocked = problems.length > 0;
  const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
    input.origin
  );

  return {
    ...result,
    verdict: blocked ? "blocked" : "allowed",
    summary: blocked
      ? `The browser will block this request from ${input.origin}. ${problems[0]}`
      : `The browser will allow this request from ${input.origin}; no proxy is needed.`,
    problems,
    ...(blocked
      ? {
          fix: {
            proxied_url: `${input.proxyBaseUrl}/?${input.url}`,
            steps: [
              "Send the request through Corsfix instead of calling the API directly (use generate_snippet for code).",
              localOrigin
                ? "Local development (localhost) works without registering anything."
                : `Register ${
                    new URL(input.origin).hostname
                  } as an origin domain with create_application (not needed for localhost).`,
              "If the API needs a key, store it as a secret with set_secret and reference it as {{SECRET_NAME}} instead of shipping it in frontend code.",
            ],
          },
        }
      : {}),
  };
}
