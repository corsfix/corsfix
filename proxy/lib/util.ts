import { Request } from "hyper-express";
import { registeredOrigins } from "free-cors-proxy";
import {
  EnvHttpProxyAgent,
  fetch,
  RequestInfo,
  RequestInit,
  Response,
  Dispatcher,
  interceptors,
} from "undici";
import { getSecretsMap } from "./services/secretService";
import ipaddr from "ipaddr.js";
import { config } from "../config/constants";

interface ProxyRequest {
  url: URL;
  ignore_ssl?: boolean;
}

export function isLocalOrigin(origin: string): boolean {
  const localOriginPatterns = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
    /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
    /^https?:\/\/0\.0\.0\.0(:\d+)?$/,
    /^https:\/\/corsfix\.com$/,
    /^https:\/\/.*\.corsfix\.com$/,
  ];
  return localOriginPatterns.some((pattern) => pattern.test(origin));
}

export function isRegisteredOrigin(origin: string, url: string): boolean {
  return (
    origin in registeredOrigins &&
    Array.from(registeredOrigins[origin]).some(
      (pattern) => url.includes(pattern) || pattern == "*"
    )
  );
}

export const getProxyRequest = (req: Request): ProxyRequest => {
  const params = req.query_parameters;

  if ("url" in params) {
    return {
      url: new URL(decodeURIComponent(params.url)),
    };
  } else {
    return {
      url: new URL(decodeURIComponent(req.path_query)),
    };
  }
};

/**
 * Function to check if a given url allowed
 * @param {string} url - The url to check
 * @param {string[]} allowedUrls - The list of allowed URLs
 * @returns {boolean} True if the url or origin is allowed, false otherwise
 */
export const isValidUrl = (url: string, allowedUrls: string[]): boolean => {
  for (const pattern of allowedUrls) {
    if (url.includes(pattern) || pattern == "*") {
      return true;
    }
  }
  return false;
};

export const getPreviousMidnightEpoch = (): number => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(0, 0, 0, 0);
  return midnight.getTime();
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

export const proxyFetch = async (
  input: RequestInfo,
  init?: RequestInit
): Promise<Response> => {
  let dispatcher = new EnvHttpProxyAgent().compose([
    (dispatch: Dispatcher.Dispatch) => {
      return (opts, handler) => {
        const { origin } = opts;
        const url = new URL(origin || "");

        if (!["http:", "https:"].includes(url.protocol)) {
          opts.origin = `http://127.0.0.1`;
          opts.path = "/error";
        }

        const address = url.hostname;
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
    interceptors.dns(),
  ]);

  const response = await fetch(input, {
    ...init,
    dispatcher,
  });
  return response;
};

export const getRpmByProductId = (product_id: string): number => {
  const product = config.products.find((p) => p.id === product_id);
  if (!product) {
    return 60;
  }

  switch (product.name) {
    case "lite":
      return 150;
    case "plus":
      return 300;
    case "pro":
      return 600;
    default:
      return 60;
  }
};
