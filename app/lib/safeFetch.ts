import http from "http";
import https from "https";
import dns from "dns";
import ipaddr from "ipaddr.js";

// Requests to user-supplied URLs made by the dashboard server itself (the
// MCP check_cors tool and OAuth client metadata documents). Only public
// internet addresses are reachable, mirroring the proxy's SSRF protection:
// every resolved address is checked, redirects are not followed, and the
// response size and duration are capped.

export class SafeFetchError extends Error {}

// ipaddr.js labels ordinary public addresses "unicast"; every other range
// (private, loopback, link-local, mapped, reserved, ...) is refused.
export const isPublicAddress = (address: string): boolean => {
  try {
    return ipaddr.parse(address).range() === "unicast";
  } catch {
    return false;
  }
};

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address?: string | dns.LookupAddress[],
  family?: number
) => void;

const safeLookup = (
  hostname: string,
  options: dns.LookupOptions,
  callback: LookupCallback
) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) {
      callback(err);
      return;
    }
    if (
      addresses.length === 0 ||
      addresses.some((entry) => !isPublicAddress(entry.address))
    ) {
      callback(
        new SafeFetchError(`${hostname} does not resolve to a public address`)
      );
      return;
    }
    if (options.all) {
      callback(null, addresses);
    } else {
      callback(null, addresses[0].address, addresses[0].family);
    }
  });
};

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface SafeFetchResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
  truncated: boolean;
}

export function assertFetchableUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError("Only http and https URLs are supported");
  }
  if (url.username || url.password) {
    throw new SafeFetchError("URLs with credentials are not supported");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (ipaddr.isValid(host) && !isPublicAddress(host)) {
    throw new SafeFetchError(`${host} is not a public address`);
  }
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new SafeFetchError(`${host} is not a public address`);
  }
}

export function safeFetch(
  target: string | URL,
  {
    method = "GET",
    headers = {},
    body,
    timeoutMs = 10_000,
    maxBytes = 64 * 1024,
  }: SafeFetchOptions = {}
): Promise<SafeFetchResponse> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(target);
      assertFetchableUrl(url);
    } catch (error) {
      reject(
        error instanceof SafeFetchError
          ? error
          : new SafeFetchError("Invalid URL")
      );
      return;
    }

    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      {
        method,
        headers: { "user-agent": "Corsfix-MCP/1.0", ...headers },
        lookup: safeLookup as unknown as http.RequestOptions["lookup"],
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;

        const finish = () => {
          clearTimeout(timer);
          const responseHeaders: Record<string, string> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            if (value === undefined) continue;
            responseHeaders[key.toLowerCase()] = Array.isArray(value)
              ? value.join(", ")
              : value;
          }
          resolve({
            status: res.statusCode || 0,
            headers: responseHeaders,
            body: Buffer.concat(chunks),
            truncated,
          });
        };

        res.on("data", (chunk: Buffer) => {
          if (truncated) return;
          size += chunk.length;
          if (size > maxBytes) {
            chunks.push(chunk.subarray(0, maxBytes - (size - chunk.length)));
            truncated = true;
            res.destroy();
            finish();
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          if (!truncated) finish();
        });
        res.on("error", (error) => {
          if (!truncated) {
            clearTimeout(timer);
            reject(error);
          }
        });
      }
    );

    const timer = setTimeout(() => {
      req.destroy(new SafeFetchError(`Timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    req.on("timeout", () => {
      req.destroy(new SafeFetchError(`Timed out after ${timeoutMs / 1000}s`));
    });
    req.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    if (body !== undefined) {
      req.write(body);
    }
    req.end();
  });
}
