import { MiddlewareNext, Request, Response } from "hyper-express";
import { getProxyRequest, isValidUrl } from "../lib/util";
import { CorsfixRequest } from "../types/api";
import { sendCorsfixError } from "../errors";

export const validateOriginHeader = (
  req: CorsfixRequest,
  res: Response,
  next: MiddlewareNext
) => {
  const origin = req.header("Origin");

  if (req.ctx_origin) {
    next();
  } else if (req.ctx_api_key_request) {
    // For API key requests, ensure ctx_origin is always a defined string.
    // Use the Origin header if present; otherwise fall back to a sentinel value.
    req.ctx_origin =
      typeof origin === "string" && origin.length > 0 ? origin : "api-key";
    req.ctx_origin_domain = "api-key";
    next();
  } else if (isValidUrl(origin)) {
    req.ctx_origin = origin;
    req.ctx_origin_domain = new URL(origin).hostname;
    next();
  } else {
    res.header("X-Robots-Tag", "noindex, nofollow");
    return sendCorsfixError(res, "invalid_origin");
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
      return sendCorsfixError(res, "invalid_referer");
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
    return sendCorsfixError(res, "invalid_url");
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
      return sendCorsfixError(res, "payload_too_large");
    }
  }
  next();
};
