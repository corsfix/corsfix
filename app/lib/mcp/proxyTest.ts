// Sends a request through the Corsfix proxy from the dashboard server, the
// way the dashboard playground does from the browser, and summarizes what
// came back.

export interface ProxyTestInput {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  cache?: string;
  overrideHeaders: Record<string, string>;
  origin: string;
  useSdk: boolean;
  proxyBaseUrl: string;
}

const MAX_BODY_BYTES = 64 * 1024;
const PREVIEW_CHARS = 4000;
const TEXT_TYPES =
  /json|text|xml|javascript|html|csv|yaml|x-www-form-urlencoded|graphql/i;

async function readLimited(
  response: Response
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  if (!response.body) return { bytes: new Uint8Array(), truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    if (size >= MAX_BODY_BYTES) {
      truncated = true;
      await reader.cancel();
      break;
    }
  }
  const bytes = new Uint8Array(Math.min(size, MAX_BODY_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    const slice = chunk.subarray(0, bytes.length - offset);
    bytes.set(slice, offset);
    offset += slice.length;
    if (offset >= bytes.length) break;
  }
  return { bytes, truncated };
}

export const proxiedUrlFor = (
  proxyBaseUrl: string,
  url: string,
  useSdk: boolean
) =>
  useSdk
    ? `${proxyBaseUrl}/?sdk=1&url=${encodeURIComponent(url)}`
    : `${proxyBaseUrl}/?${url}`;

export async function runProxyTest(input: ProxyTestInput) {
  const proxiedUrl = proxiedUrlFor(input.proxyBaseUrl, input.url, input.useSdk);
  const headers: Record<string, string> = {
    ...input.headers,
    Origin: input.origin,
  };
  if (input.cache) headers["x-corsfix-cache"] = input.cache;
  if (Object.keys(input.overrideHeaders).length > 0) {
    headers["x-corsfix-headers"] = JSON.stringify(input.overrideHeaders);
  }

  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(proxiedUrl, {
      method: input.method,
      headers,
      body:
        input.method === "GET" || input.method === "HEAD"
          ? undefined
          : input.body,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    return {
      request: {
        proxied_url: proxiedUrl,
        origin: input.origin,
        method: input.method,
      },
      error: `The proxy could not be reached: ${
        error instanceof Error ? error.message : "request failed"
      }`,
    };
  }

  const { bytes, truncated } = await readLimited(response);
  const elapsed = Date.now() - started;
  const contentType = response.headers.get("content-type") || "";
  const textual = contentType === "" || TEXT_TYPES.test(contentType);
  const text = textual ? new TextDecoder().decode(bytes) : null;

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    if (Object.keys(responseHeaders).length < 40) responseHeaders[key] = value;
  });

  const corsfixStatus = response.headers.get("x-corsfix-status");
  let corsfixError: Record<string, string> | undefined;
  if (
    corsfixStatus &&
    corsfixStatus !== "success" &&
    corsfixStatus !== "preflight"
  ) {
    corsfixError = { code: corsfixStatus };
    try {
      const parsed = JSON.parse(text || "{}");
      if (parsed.message) corsfixError.message = parsed.message;
      if (parsed.if_you_are_admin)
        corsfixError.what_to_do = parsed.if_you_are_admin;
    } catch {
      // keep the code only
    }
  }

  return {
    request: {
      proxied_url: proxiedUrl,
      origin: input.origin,
      method: input.method,
    },
    status: response.status,
    time_ms: elapsed,
    corsfix_status: corsfixStatus,
    ...(corsfixError
      ? {
          corsfix_error: corsfixError,
          summary: `The proxy rejected the request (${corsfixStatus}).`,
        }
      : {
          summary:
            corsfixStatus === "success"
              ? `The proxy fetched the target, which answered ${response.status}.`
              : `Got ${response.status} from the proxy.`,
        }),
    headers: responseHeaders,
    content_type: contentType || null,
    size_bytes: truncated ? `${bytes.length}+` : bytes.length,
    body_preview:
      text === null
        ? `Binary content (${contentType}) not shown.`
        : text.length > PREVIEW_CHARS
        ? `${text.slice(0, PREVIEW_CHARS)}…`
        : text,
    body_truncated: truncated || (text !== null && text.length > PREVIEW_CHARS),
  };
}
