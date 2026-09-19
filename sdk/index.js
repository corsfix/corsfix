const DEFAULT_PROXY_URL = "https://proxy.corsfix.com";

/**
 * Thrown by `corsfix.fetch` when the Corsfix proxy itself rejects or fails
 * the request. Errors returned by the target server (e.g. a 404 from the API
 * you are calling) are NOT converted into CorsfixError; they come back as a
 * normal Response, exactly like native fetch.
 */
export class CorsfixError extends Error {
  constructor({ code, status, message, ifYouAreAdmin, ifYouAreUser, response }) {
    super(message);
    this.name = "CorsfixError";
    this.code = code;
    this.status = status;
    this.ifYouAreAdmin = ifYouAreAdmin;
    this.ifYouAreUser = ifYouAreUser;
    this.response = response;
  }
}

const isErrorStatus = (status) =>
  status !== null && status !== "success" && status !== "preflight";

const toCorsfixError = async (response, code) => {
  let body = null;
  try {
    body = await response.clone().json();
  } catch {
    // Body is not JSON; fall back to the header code alone.
  }

  return new CorsfixError({
    code: body?.corsfix_error ?? code,
    status: response.status,
    message: body?.message ?? `Corsfix proxy error: ${code}`,
    ifYouAreAdmin: body?.if_you_are_admin,
    ifYouAreUser: body?.if_you_are_user,
    response,
  });
};

const targetUrlOf = (input) => {
  if (input instanceof Request) return input.url;
  if (input instanceof URL) return input.href;
  return String(input);
};

const proxiedUrlFor = (targetUrl, proxyUrl) => {
  const base = (proxyUrl || DEFAULT_PROXY_URL).replace(/\/+$/, "");
  return `${base}/?${targetUrl}`;
};

// Re-creates a Request against the proxied URL, carrying over everything a
// caller may have set on it. Mirrors what native fetch(request, init) sees.
// "navigate" is the one mode the Request constructor refuses, so it is left
// to default; every other setting is copied verbatim.
const retarget = (request, url) =>
  new Request(url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    ...(request.mode !== "navigate" ? { mode: request.mode } : {}),
    credentials: request.credentials,
    cache: request.cache,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    integrity: request.integrity,
    keepalive: request.keepalive,
    signal: request.signal,
    ...(request.body ? { duplex: "half" } : {}),
  });

const corsfixFetch = async (input, options = {}) => {
  const { corsfix = {}, ...fetchOptions } = options;

  const isRequest = input instanceof Request;
  const proxiedUrl = proxiedUrlFor(targetUrlOf(input), corsfix.proxyUrl);
  const proxiedInput = isRequest ? retarget(input, proxiedUrl) : proxiedUrl;

  // Like native fetch: init.headers replaces the Request's headers entirely.
  const headers = new Headers(
    fetchOptions.headers ?? (isRequest ? proxiedInput.headers : {})
  );

  if (corsfix.cache) {
    headers.set("x-corsfix-cache", String(corsfix.cache));
  }

  if (corsfix.headers) {
    headers.set("x-corsfix-headers", JSON.stringify(corsfix.headers));
  }

  if (corsfix.apiKey) {
    headers.set("x-corsfix-key", corsfix.apiKey);
  }

  const response = await globalThis.fetch(proxiedInput, {
    ...fetchOptions,
    headers,
  });

  const status = response.headers.get("x-corsfix-status");
  if (isErrorStatus(status)) {
    throw await toCorsfixError(response, status);
  }

  return response;
};

const corsfix = {
  fetch: corsfixFetch,
  CorsfixError,
};

export default corsfix;
