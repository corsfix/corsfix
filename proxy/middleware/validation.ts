import { MiddlewareNext, Request, Response } from "hyper-express";
import { getProxyRequest } from "../lib/util";
import { CorsfixRequest } from "../types/api";

export const validateOriginHeader = (
  req: CorsfixRequest,
  res: Response,
  next: MiddlewareNext
) => {
  const origin = req.header("Origin");
  try {
    new URL(origin);
  } catch (error) {
    res.header("X-Robots-Tag", "noindex, nofollow");
    return res
      .status(400)
      .end(
        "Corsfix: Origin header not found. Check the documentation for CORS proxy API usage. (https://corsfix.com/docs/cors-proxy/api)"
      );
  }
  req.ctx_origin = origin;
  next();
};

export const validateUrl = (
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
