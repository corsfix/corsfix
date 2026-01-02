import { Request } from "hyper-express";
import { EnvHttpProxyAgent, Dispatcher, interceptors, request } from "undici";
import { getSecretsMap } from "./services/secretService";
import ipaddr from "ipaddr.js";
import { UserV2Entity } from "../models/UserV2Entity";
import { getConfig } from "./config";
import { Readable } from "stream";
import { ApiKeyUser } from "./services/apiKeyService";

interface ProxyRequest {
  url: URL;
  callback?: string;
}

export const isDomainAllowed = (
  domain: string,
  allowedDomains: string[]
): boolean => {
  return allowedDomains.some(
    (allowed) => allowed === "*" || allowed === domain
  );
};

export const isLocalDomain = (domain: string): boolean => {
  const localDomains = ["localhost", "corsfix.com", "app.corsfix.com"];

  // Check for exact match
  if (localDomains.includes(domain)) {
    return true;
  }

  // Check for .localhost subdomains (e.g., api.localhost)
  if (domain.toLowerCase().endsWith(".localhost")) {
    return true;
  }

  // Check for IPv6 loopback
  if (domain.includes(":")) {
    // Remove brackets (e.g., [::1]) for comparison
    const ipv6Address = domain.toLowerCase().replace(/^\[|\]$/g, "");
    if (ipv6Address === "::1") {
      return true;
    }
  }

  // Check for IPv4 private/local ranges
  const ipv4Patterns = [
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // Loopback (127.x.x.x)
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // Class A private (10.x.x.x)
    /^192\.168\.\d{1,3}\.\d{1,3}$/, // Class C private (192.168.x.x)
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/, // Class B private (172.16-31.x.x)
    /^0\.0\.0\.0$/, // Unspecified
  ];

  return ipv4Patterns.some((pattern) => pattern.test(domain));
};

export const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
};

const processUrlString = (urlString: string): URL => {
  const processedUrl = /^https?:\/\//.test(urlString)
    ? urlString
    : `https://${urlString}`;
  return new URL(decodeURIComponent(processedUrl));
};

export const getProxyRequest = (req: Request): ProxyRequest => {
  let inputUrl: string;
  let callback: string | undefined;

  if (req.path !== "/") {
    inputUrl = req.path.substring(1);
  } else if ("url" in req.query_parameters) {
    inputUrl = req.query_parameters.url;
    callback = req.query_parameters.callback;
  } else {
    inputUrl = req.path_query;
  }

  return { url: processUrlString(inputUrl), callback: callback };
};

export const processRequest = async (
  url: URL,
  headers: Record<string, string>,
  application_id: string | null
): Promise<{ url: URL; headers: Record<string, string> }> => {
  if (!application_id) {
    return { url, headers };
  }

  const variables = new Set<string>();

  // Find all variables in URL search params
  url.searchParams.forEach((value, key) => {
    if (!value) return;
    const regex = /\{\{([^{}]+)\}\}/g;
    let match;
    while ((match = regex.exec(value)) !== null) {
      variables.add(match[1]);
    }
  });

  // Find all variables in header values
  Object.values(headers).forEach((value) => {
    if (!value) return;
    const regex = /\{\{([^{}]+)\}\}/g;
    let match;
    while ((match = regex.exec(value)) !== null) {
      variables.add(match[1]);
    }
  });

  // Skip processing if no variables found
  if (variables.size === 0) {
    return { url, headers };
  }

  // Decrypt secrets
  const secretsMap = await getSecretsMap(variables, application_id);

  // replace the variables in the url search params
  url.searchParams.forEach((value, key) => {
    const regex = /\{\{([^{}]+)\}\}/g;
    const newValue = value.replace(regex, (match, variable) => {
      const secretValue = secretsMap[variable];
      if (secretValue) {
        return secretValue;
      } else {
        return match;
      }
    });
    url.searchParams.set(key, newValue);
  });

  // Replace variables in headers
  const processedHeaders = { ...headers };
  Object.entries(processedHeaders).forEach(([key, value]) => {
    if (!value) return;
    const regex = /\{\{([^{}]+)\}\}/g;
    const newValue = value.replace(regex, (match, variable) => {
      const secretValue = secretsMap[variable];
      if (secretValue) {
        return secretValue;
      } else {
        return match;
      }
    });
    processedHeaders[key] = newValue;
  });

  return { url: url, headers: processedHeaders };
};

export interface ProxyRequestOptions {
  method: string;
  body?: string | Buffer | Uint8Array | Readable | null | FormData;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  decompress?: boolean;
  maxRedirects?: number;
}

export const proxyRequest = async (
  url: URL,
  options: ProxyRequestOptions
): Promise<Dispatcher.ResponseData<any>> => {
  const interceptorList = [
    (dispatch: Dispatcher.Dispatch) => {
      return (
        opts: Dispatcher.DispatchOptions,
        handler: Dispatcher.DispatchHandler
      ) => {
        const { origin } = opts;
        const url = new URL(origin || "");

        if (!["http:", "https:"].includes(url.protocol)) {
          opts.origin = `http://127.0.0.1`;
          opts.path = "/error";
        }

        const address = url.hostname.replace(/^\[|\]$/g, "");
        const range = ipaddr.parse(address).range();
        if (
          [
            "unspecified",
            "linkLocal",
            "loopback",
            "private",
            "reserved",
          ].includes(range)
        ) {
          opts.origin = `http://127.0.0.1`;
          opts.path = "/error";
        }

        return dispatch(opts, handler);
      };
    },
    interceptors.dns({
      dualStack: false,
    }),
  ];
  if (options.decompress) {
    interceptorList.unshift(interceptors.decompress());
  }

  const dispatcher = new EnvHttpProxyAgent().compose(interceptorList);
  const maxRedirections = options.maxRedirects ?? 0;
  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount <= maxRedirections) {
    const result = await request(currentUrl, {
      method: options.method,
      body: options.body,
      headers: options.headers,
      signal: options.signal,
      dispatcher: dispatcher,
    });

    if (300 <= result.statusCode && result.statusCode <= 399) {
      const location = result.headers.location;
      if (!location) {
        return result;
      }

      redirectCount++;
      if (redirectCount > maxRedirections) {
        return result;
      }

      currentUrl = new URL(location, currentUrl);
    } else {
      return result;
    }
  }

  throw new Error("Maximum redirects exceeded");
};

export const getRpmByProductId = (product_id: string): number => {
  const config = getConfig();
  const product = config.products.find((p) => p.id === product_id);
  if (!product) {
    return 60;
  }

  return product.rpm;
};

export const isTrialActive = (
  user: UserV2Entity | ApiKeyUser | null
): boolean => {
  if (!user) {
    return false;
  }

  const now = new Date();
  const trialEndsAt =
    user.trial_ends_at || new Date("2025-10-05T00:00:00.000Z");

  return now < trialEndsAt;
};
