import { safeFetch, SafeFetchError, SafeFetchResponse } from "@/lib/safeFetch";

// Reproduces the browser's CORS checks (Fetch standard) against a live URL,
// so an agent can tell whether a request will be blocked before suggesting
// a proxy.

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

// CORS-unsafe request-header bytes (Fetch standard).
const UNSAFE_HEADER_BYTE = /[\x00-\x08\x0a-\x1f"():<>?@\[\\\]{}\x7f]/;
const LANGUAGE_HEADER_VALUE = /^[0-9A-Za-z *,\-.;=]*$/;

// Why a header makes the request need a preflight, or null when it is a
// CORS-safelisted request-header (Fetch standard). Only accept,
// accept-language, content-language, content-type and range can be
// safelisted, and only with values of up to 128 bytes in a limited format.
function safelistProblem(rawName: string, value: string): string | null {
  const name = rawName.toLowerCase();
  const notSafelisted = `the ${rawName} header is not CORS-safelisted`;
  const valueProblem = `the ${rawName} header's value is not CORS-safelisted (it must be at most 128 bytes without characters such as quotes, parentheses, colons or braces)`;

  switch (name) {
    case "accept":
      return value.length > 128 || UNSAFE_HEADER_BYTE.test(value)
        ? valueProblem
        : null;
    case "accept-language":
    case "content-language":
      return value.length > 128 || !LANGUAGE_HEADER_VALUE.test(value)
        ? valueProblem
        : null;
    case "content-type": {
      if (value.length > 128 || UNSAFE_HEADER_BYTE.test(value)) {
        return valueProblem;
      }
      const essence = value.split(";")[0].trim().toLowerCase();
      return SIMPLE_CONTENT_TYPES.has(essence)
        ? null
        : `Content-Type ${value} is not one of the simple content types (application/x-www-form-urlencoded, multipart/form-data, text/plain)`;
    }
    case "range": {
      const range = /^bytes=(\d+)-(\d*)$/.exec(value);
      const valid =
        value.length <= 128 &&
        range !== null &&
        (range[2] === "" || Number(range[1]) <= Number(range[2]));
      return valid ? null : "the Range header is not a single byte range";
    }
    default:
      return notSafelisted;
  }
}

export function analyzeRequest(
  method: string,
  headers: Record<string, string>
): RequestShape {
  const reasons: string[] = [];
  const unsafeHeaders = new Set<string>();
  const safelisted: string[] = [];
  let safelistedBytes = 0;

  if (!SIMPLE_METHODS.has(method)) {
    reasons.push(
      `${method} is not a simple method (only GET, HEAD and POST are)`
    );
  }

  // Like the browser's Headers object, combine names that differ only in
  // case, and strip leading and trailing whitespace from values.
  const combined = new Map<string, { rawName: string; values: string[] }>();
  for (const [rawName, rawValue] of Object.entries(headers)) {
    const name = rawName.toLowerCase();
    const value = rawValue.replace(/^[\t\n\r ]+|[\t\n\r ]+$/g, "");
    const entry = combined.get(name);
    if (entry) entry.values.push(value);
    else combined.set(name, { rawName, values: [value] });
  }

  for (const [name, { rawName, values }] of combined) {
    if (BROWSER_MANAGED_HEADERS.has(name)) continue;
    const value = values.join(", ");
    const problem = safelistProblem(rawName, value);
    if (problem) {
      unsafeHeaders.add(name);
      reasons.push(problem);
    } else {
      safelisted.push(name);
      safelistedBytes += value.length;
    }
  }

  if (safelistedBytes > 1024) {
    safelisted.forEach((name) => unsafeHeaders.add(name));
    reasons.push(
      "the CORS-safelisted headers are longer than 1024 bytes together"
    );
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
  // Only GET and HEAD are sent for real. Other methods could change data on
  // the target, so a GET to the same URL stands in for them, and its result
  // only suggests what the real response would do.
  const probeMethod = method === "HEAD" ? "HEAD" : "GET";
  const substituted = probeMethod !== method;
  let preflightProblems: string[] = [];
  let responseProblems: string[] = [];

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
      preflightProblems = evaluatePreflight(preflight, {
        origin: input.origin,
        method,
        unsafeHeaders: shape.unsafeHeaders,
        credentials: input.credentials,
      });
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

    const response = await safeFetch(input.url, {
      method: probeMethod,
      headers: { origin: input.origin },
      maxBytes: 4 * 1024,
    });
    responseProblems = checkAllowOrigin(
      response,
      input.origin,
      input.credentials
    );
    result.response = {
      method_checked: probeMethod,
      ...(substituted
        ? {
            note: `${method} was not sent because it could change data on the target. This is the response to a GET, and some APIs send different CORS headers for different methods.`,
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

  const problems = [...preflightProblems, ...responseProblems];
  const likelyBlocked = problems.length > 0;
  let verdict: "allowed" | "blocked" | "inconclusive";
  let summary: string;
  if (preflightProblems.length > 0) {
    verdict = "blocked";
    summary = `The browser will block this request from ${input.origin} at the preflight. ${preflightProblems[0]}`;
  } else if (!substituted) {
    verdict = likelyBlocked ? "blocked" : "allowed";
    summary = likelyBlocked
      ? `The browser will block this request from ${input.origin}. ${responseProblems[0]}`
      : `The browser will allow this request from ${input.origin}; no proxy is needed.`;
  } else {
    verdict = "inconclusive";
    const preflightPart = shape.needsPreflight
      ? "The preflight passes"
      : "No preflight is needed";
    summary = likelyBlocked
      ? `${preflightPart}, but ${method} was not sent. A GET to the same URL is blocked (${responseProblems[0]}), so the ${method} response is most likely blocked too.`
      : `${preflightPart}, but ${method} was not sent. A GET to the same URL passes, so the ${method} response is most likely allowed, unless the API sends different CORS headers for ${method}.`;
  }

  const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
    input.origin
  );

  return {
    ...result,
    verdict,
    ...(verdict === "inconclusive"
      ? { likely: likelyBlocked ? "blocked" : "allowed" }
      : {}),
    summary,
    problems,
    ...(likelyBlocked
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
