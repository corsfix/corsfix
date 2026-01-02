import { MiddlewareNext, Request, Response } from "hyper-express";
import { getProxyRequest, isValidUrl } from "../lib/util";
import { CorsfixRequest } from "../types/api";

export const validateOriginHeader = (
  req: CorsfixRequest,
  res: Response,
  next: MiddlewareNext
) => {
  const origin = req.header("Origin");

  if (req.ctx_origin) {
    next();
  } else if (req.ctx_api_key_request) {
    req.ctx_origin = origin;
    req.ctx_origin_domain = "api-key";
    next();
  } else if (isValidUrl(origin)) {
    req.ctx_origin = origin;
    req.ctx_origin_domain = new URL(origin).hostname;
    next();
  } else {
    res.header("X-Robots-Tag", "noindex, nofollow");
    res.header("X-Corsfix-Status", "invalid_origin", true);
    return res
      .status(400)
      .end(
        "Corsfix: Missing or invalid Origin header. This CORS proxy is intended for use with fetch/AJAX requests in your JavaScript code, not as a generic web proxy. (https://corsfix.com/docs/cors-proxy/api)"
      );
  }
};

export const validateJsonpRequest = (
  req: CorsfixRequest,
  res: Response,
  next: MiddlewareNext
) => {
  const callback = req.ctx_callback!;
  const referer = req.header("Referer");

  if (callback) {
    if (isValidUrl(referer)) {
      const referrerUrl = new URL(referer);
      req.ctx_origin = referrerUrl.origin;
      req.ctx_origin_domain = referrerUrl.hostname;
    } else {
      res.header("X-Corsfix-Status", "invalid_referer", true);
      return res
        .status(400)
        .end(
          "Corsfix: Missing or invalid Referer header for JSONP request. (https://corsfix.com/docs/cors-proxy/jsonp)"
        );
    }
  }

  next();
};

export const validateTargetUrl = (
  req: CorsfixRequest,
  res: Response,
  next: MiddlewareNext
) => {
  if (!req.path_query && req.path == "/") {
    res.status(301);
    res.header("Cache-Control", "public, max-age=3600");
    res.header("Location", "https://corsfix.com");
    res.end();
  }

  try {
    const { url, callback } = getProxyRequest(req);

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Invalid protocol. Only HTTP and HTTPS are allowed.");
    }

    if (!url.hostname.includes(".")) {
      throw new Error("Invalid hostname. TLD is required.");
    }

    req.ctx_url = url;
    req.ctx_target_domain = url.hostname;
    req.ctx_callback = callback;
  } catch (e) {
    res.header("X-Robots-Tag", "noindex, nofollow");
    res.header("X-Corsfix-Status", "invalid_url", true);
    return res
      .status(400)
      .end(
        "Corsfix: Invalid URL provided. Check the documentation for CORS proxy API usage. (https://corsfix.com/docs/cors-proxy/api)"
      );
  }
  next();
};

export const validatePayloadSize = (
  req: Request,
  res: Response,
  next: MiddlewareNext
) => {
  const contentLengthHeader = req.header("content-length");
  if (contentLengthHeader) {
    const contentLength = parseInt(contentLengthHeader, 10);
    if (!isNaN(contentLength) && contentLength > 5 * 1024 * 1024) {
      res.header("X-Corsfix-Status", "payload_too_large", true);
      return res
        .status(413)
        .end(
          "Corsfix: Payload Too Large. Maximum allowed request size is 5MB. (https://corsfix.com/docs/cors-proxy/api)"
        );
    }
  }
  next();
};
