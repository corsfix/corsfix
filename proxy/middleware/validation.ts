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
  } else if (isValidUrl(origin)) {
    req.ctx_origin = origin;
    next();
  } else {
    res.header("X-Robots-Tag", "noindex, nofollow");
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
  const referer = req.header("Referer");
  const secFetchDest = req.header("Sec-Fetch-Dest");

  if (secFetchDest === "script") {
    if (isValidUrl(referer)) {
      req.ctx_origin = new URL(referer).origin;
    } else {
      // invalid jsonp use
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
  req: Request,
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
    const proxyReq = getProxyRequest(req);

    if (!["http:", "https:"].includes(proxyReq.url.protocol)) {
      throw new Error("Invalid protocol. Only HTTP and HTTPS are allowed.");
    }

    if (!proxyReq.url.hostname.includes(".")) {
      throw new Error("Invalid hostname. TLD is required.");
    }
  } catch (e) {
    res.header("X-Robots-Tag", "noindex, nofollow");
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
      return res
        .status(413)
        .end(
          "Corsfix: Payload Too Large. Maximum allowed request size is 5MB. (https://corsfix.com/docs/cors-proxy/api)"
        );
    }
  }
  next();
};
