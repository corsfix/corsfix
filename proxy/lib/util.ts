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
  callback?: string;
}

export function isLocalOrigin(origin: string): boolean {
  const localOriginPatterns = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
    /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
    /^https?:\/\/0\.0\.0\.0(:\d+)?$/,
    /^https:\/\/corsfix\.com$/,
    /^https:\/\/app\.corsfix\.com$/,
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

  return product.rpm;
};
