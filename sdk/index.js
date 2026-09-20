const DEFAULT_PROXY_URL = "https://proxy.corsfix.com";

const FREE_TIER_UPGRADE_URL = "https://app.corsfix.com/billing";
const NOTICE_ID = "corsfix-free-tier-notice";
const NOTICE_TITLE = "This site has reached its free Corsfix limit";
// Fallback only; the proxy sends visitor-facing copy in if_you_are_user.
const NOTICE_FALLBACK = "Ask the site owner to upgrade so it keeps working.";

const isFreeTierStatus = (status) =>
  typeof status === "string" && status.startsWith("free_tier_");

// Shown on every free tier error. If a notice is already on the page its
// text is updated in place, so there is never more than one.
const renderNotice = (message) => {
  const existing = document.getElementById(NOTICE_ID);
  if (existing) {
    existing.querySelector("[data-corsfix-message]").textContent = message;
    return;
  }

  const notice = document.createElement("div");
  notice.id = NOTICE_ID;
  notice.setAttribute("role", "status");
  notice.style.cssText =
    "position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:320px;" +
    "padding:12px 36px 12px 14px;border-radius:8px;background:#1f1f24;color:#f5f5f7;" +
    "font:13px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
    "box-shadow:0 4px 16px rgba(0,0,0,.25);";

  const title = document.createElement("div");
  title.textContent = NOTICE_TITLE;
  title.style.cssText = "font-weight:600;margin-bottom:4px;";

  const body = document.createElement("div");
  body.setAttribute("data-corsfix-message", "");
  body.textContent = message;

  // For the one person who can act on this; labeled so visitors skip it.
  const link = document.createElement("a");
  link.href = FREE_TIER_UPGRADE_URL;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Site owner? Upgrade \u2192";
  link.style.cssText =
    "display:inline-block;margin-top:8px;color:#c4b5fd;text-decoration:underline;";

  const text = document.createElement("div");
  text.appendChild(title);
  text.appendChild(body);
  text.appendChild(link);

  const close = document.createElement("button");
  close.type = "button";
  close.setAttribute("aria-label", "Dismiss");
  close.textContent = "\u00d7";
  close.style.cssText =
    "position:absolute;top:6px;right:8px;background:none;border:0;color:inherit;" +
    "font-size:18px;line-height:1;cursor:pointer;padding:2px 4px;";
  close.onclick = () => notice.remove();

  notice.appendChild(text);
  notice.appendChild(close);
  document.body.appendChild(notice);
};

// The free tier is only reachable through the SDK because the SDK is what
// tells the site (and its owner) that a limit was hit. The request still
// fails with a CorsfixError; the notice is a courtesy, not a workaround.
const showFreeTierNotice = (error) => {
  const message = error.ifYouAreUser || NOTICE_FALLBACK;

  if (typeof document === "undefined") {
    console.warn(`[corsfix] ${NOTICE_TITLE}. ${message} ${FREE_TIER_UPGRADE_URL}`);
    return;
  }

  if (document.body) {
    renderNotice(message);
  } else {
    document.addEventListener("DOMContentLoaded", () => renderNotice(message), {
      once: true,
    });
  }
};

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

// Uses the proxy's `url=` form so the target's own query string survives
// encoding, and flags the request as SDK traffic with `sdk=1`. A query flag
// rather than a header keeps plain GETs free of CORS preflights.
const proxiedUrlFor = (targetUrl, proxyUrl) => {
  const base = (proxyUrl || DEFAULT_PROXY_URL).replace(/\/+$/, "");
  return `${base}/?sdk=1&url=${encodeURIComponent(targetUrl)}`;
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
    const error = await toCorsfixError(response, status);
    if (isFreeTierStatus(status)) {
      showFreeTierNotice(error);
    }
    throw error;
  }

  return response;
};

const corsfix = {
  fetch: corsfixFetch,
  CorsfixError,
};

export default corsfix;
