// Redirect URI rules for MCP clients.
//
// Allowed: https URLs, http URLs on a loopback host (desktop apps and CLIs
// listen on a local port), and private-use schemes of native apps such as
// "cursor://" or "vscode://" (RFC 8252 section 7.1). Schemes that could run
// code or read local data are refused.

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const FORBIDDEN_SCHEMES = new Set([
  "javascript:",
  "data:",
  "file:",
  "vbscript:",
  "blob:",
  "about:",
  "filesystem:",
  "view-source:",
  "ftp:",
  "ws:",
  "wss:",
  "mailto:",
  "tel:",
  "sms:",
]);

export const isLoopbackRedirect = (url: URL): boolean =>
  url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);

// Returns a description of the problem, or null when the URI is acceptable.
export const validateRedirectUri = (value: string): string | null => {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) {
    return "must be a URL of at most 2048 characters";
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "is not a valid URL";
  }

  if (url.hash) return "must not contain a fragment";

  if (url.protocol === "https:") {
    return url.hostname ? null : "must include a host";
  }
  if (url.protocol === "http:") {
    return isLoopbackRedirect(url)
      ? null
      : "must use https unless it points to localhost";
  }
  if (FORBIDDEN_SCHEMES.has(url.protocol)) {
    return `uses the ${url.protocol} scheme, which is not allowed`;
  }
  if (!/^[a-z][a-z0-9+.-]*:$/.test(url.protocol)) {
    return "uses an invalid scheme";
  }
  return null;
};

// Exact string comparison, except that loopback redirect URIs may use any
// port (RFC 8252 section 7.3), because native apps pick a free port at runtime.
export const redirectUriMatches = (
  registered: string,
  requested: string
): boolean => {
  if (registered === requested) return true;
  try {
    const a = new URL(registered);
    const b = new URL(requested);
    return (
      isLoopbackRedirect(a) &&
      isLoopbackRedirect(b) &&
      a.hostname === b.hostname &&
      a.pathname === b.pathname &&
      a.search === b.search &&
      !b.hash
    );
  } catch {
    return false;
  }
};

// What the consent screen shows as "you will be sent back to ...".
export const redirectDisplayTarget = (value: string): string => {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.host;
    return `${url.protocol}//${url.host}`;
  } catch {
    return value;
  }
};
