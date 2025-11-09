import { MiddlewareNext, Request, Response, Server } from "hyper-express";
import { proxyFetch, processRequest, isLocalDomain } from "./lib/util";
import { getApplication } from "./lib/services/applicationService";
import {
  validateJsonpRequest,
  validateOriginHeader,
  validatePayloadSize,
  validateTargetUrl,
} from "./middleware/validation";
import { handlePreflight } from "./middleware/preflight";
import { handleMetrics } from "./middleware/metrics";
import { CorsfixRequest } from "./types/api";
import { handleProxyAccess } from "./middleware/access";
import { Response as APIResponse } from "undici";

import "dotenv/config";

const TEXT_ONLY = process.env.TEXT_ONLY === "true";
const ONE_MEGABYTE = 1024 * 1024;

const decoder = new TextDecoder("utf-8", { fatal: true });

export const app = new Server({
  max_body_length: 10 * 1024 * 1024,
  fast_abort: true,
});

app.set_error_handler((_: Request, res: Response, error: Error) => {
  console.error("Uncaught error occurred.", error);
  res.status(500).end("Corsfix: Uncaught error occurred.");
});

app.use("/", (req: Request, res: Response, next: MiddlewareNext) => {
  if (req.path == "/up") {
    res.header("X-Robots-Tag", "noindex, nofollow");
    return res.status(200).end("Corsfix: OK.");
  } else if (req.path == "/error") {
    res.header("X-Robots-Tag", "noindex, nofollow");
    return res.status(400).end("Corsfix: Error.");
  }
  next();
});

app.use("/", handleMetrics);

app.use("/", validatePayloadSize);
app.use("/", validateTargetUrl);
app.use("/", validateJsonpRequest);
app.use("/", validateOriginHeader);

app.use("/", handlePreflight);

app.use("/", handleProxyAccess);

app.any("/*", async (req: CorsfixRequest, res: Response) => {
  const targetUrl = req.ctx_url!;
  const callback = req.ctx_callback;

  const origin = req.ctx_origin!;
  const origin_domain = req.ctx_origin_domain!;

  req.ctx_cached_request = "x-corsfix-cache" in req.headers;

  const filteredHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey != "referer" &&
      lowerKey != "origin" &&
      !lowerKey.startsWith("sec-") &&
      !lowerKey.startsWith("x-corsfix-") &&
      !lowerKey.startsWith("x-forwarded-")
    ) {
      filteredHeaders[key] = value;
    }
  }

  let customHeaders = req.header("x-corsfix-headers");
  if (!!customHeaders) {
    try {
      customHeaders = JSON.parse(customHeaders);
      Object.entries(customHeaders).forEach(
        (entry) => (filteredHeaders[entry[0].toLowerCase()] = entry[1])
      );
    } catch (e) {}
  }

  try {
    let { targetUrl: processedUrl, filteredHeaders: processedHeaders } = {
      targetUrl,
      filteredHeaders,
    };
    if (!isLocalDomain(origin_domain)) {
      const application = await getApplication(origin_domain);
      ({ url: processedUrl, headers: processedHeaders } = await processRequest(
        targetUrl,
        filteredHeaders,
        application?.id || null
      ));
    }

    const apiResponse = await proxyFetch(processedUrl, {
      method: req.method,
      headers: processedHeaders,
      redirect: "follow",
      body: ["GET", "HEAD"].includes(req.method)
        ? undefined
        : await req.buffer(),
      signal: AbortSignal.timeout(20000),
    });

    const responseHeaders = new Headers();
    for (const [key, value] of apiResponse.headers.entries()) {
      responseHeaders.set(key, value);
    }

    if (!callback) {
      responseHeaders.set("Access-Control-Allow-Origin", origin);
      responseHeaders.set("Access-Control-Expose-Headers", "*");
    }

    responseHeaders.delete("content-encoding");
    responseHeaders.delete("transfer-encoding");

    responseHeaders.delete("set-cookie");
    responseHeaders.delete("set-cookie2");

    if (req.ctx_cached_request && !callback) {
      responseHeaders.delete("expires");
      responseHeaders.set("Cache-Control", "public, max-age=3600");
    }

    if (callback) {
      jsonpHandler(res, callback, apiResponse, responseHeaders);
    } else if (TEXT_ONLY) {
      textOnlyHandler(req, res, apiResponse, responseHeaders);
    } else {
      corsHandler(req, res, apiResponse, responseHeaders);
    }
  } catch (error: unknown) {
    const { name, message, cause } = error as Error;
    if (name === "AbortError" || name === "TimeoutError") {
      res
        .status(504)
        .end(
          "Corsfix: Timeout fetching the target URL. Check documentation for timeout limits. (https://corsfix.com/docs/cors-proxy/api)"
        );
    } else if (message === "fetch failed") {
      if ((cause as any).code === "ENOTFOUND") {
        res.status(404).end("Corsfix: Target URL not found.");
      } else {
        console.error("Fetch error occurred.", error);
        res.status(502).end("Corsfix: Unable to reach target URL.");
      }
    } else {
      console.error("Unknown error occurred.", error);
      res.status(500).end("Corsfix: Unknown error occurred.");
    }
  }
});

const corsHandler = async (
  req: CorsfixRequest,
  res: Response,
  apiResponse: APIResponse,
  responseHeaders: Headers
) => {
  // CORS request
  res.status(apiResponse.status);

  for (const [key, value] of responseHeaders.entries()) {
    res.header(key, value);
  }

  if (apiResponse.body) {
    const reader = apiResponse.body.getReader();
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
      bytes += value.length;
    }
    req.ctx_bytes = bytes;
  }

  return res.end();
};

const textOnlyHandler = async (
  req: CorsfixRequest,
  res: Response,
  apiResponse: APIResponse,
  responseHeaders: Headers
) => {
  // check Content-Length
  const contentLengthHeader = apiResponse.headers.get("content-length");
  const contentLength = contentLengthHeader
    ? parseInt(contentLengthHeader, 10)
    : null;
  if (
    contentLength !== null &&
    !isNaN(contentLength) &&
    contentLength > ONE_MEGABYTE
  ) {
    return res.status(400).end("Corsfix: Text response size too large.");
  }

  res.status(apiResponse.status);

  for (const [key, value] of responseHeaders.entries()) {
    res.header(key, value);
  }

  if (apiResponse.body) {
    const reader = apiResponse.body.getReader();
    let bytes = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      bytes += value.length;

      // Check if we exceeded size limit
      if (bytes > ONE_MEGABYTE) {
        return res.status(400).end("Corsfix: Response size too large.");
      }
    }

    req.ctx_bytes = bytes;

    const fullResponse = Buffer.concat(chunks);

    // Try to decode as text
    try {
      const text = decoder.decode(fullResponse);
      return res.send(text);
    } catch (error) {
      return res.status(400).end("Corsfix: Response is not valid text.");
    }
  }

  return res.end();
};

const jsonpHandler = async (
  res: Response,
  callback: string,
  apiResponse: APIResponse,
  responseHeaders: Headers
) => {
  let body;
  let type: "json" | "text" | "base64" | "empty" = "empty";
  if (apiResponse.body) {
    const contentLengthHeader = apiResponse.headers.get("content-length");
    const contentLength = contentLengthHeader
      ? parseInt(contentLengthHeader, 10)
      : null;
    if (
      contentLength !== null &&
      !isNaN(contentLength) &&
      contentLength > ONE_MEGABYTE
    ) {
      return res
        .status(400)
        .end("Corsfix: Response size too large for JSONP (max 1MB).");
    }

    const reader = apiResponse.body.getReader();
    let bytes = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      bytes += value.length;

      // Check if we exceeded size limit
      if (bytes > ONE_MEGABYTE) {
        return res
          .status(400)
          .end("Corsfix: Response size too large for JSONP (max 1MB).");
      }
    }

    const buf = Buffer.concat(chunks);

    try {
      const text = decoder.decode(buf);
      try {
        const json = JSON.parse(text);
        type = "json";
        body = json;
      } catch {
        type = "text";
        body = text;
      }
    } catch {
      type = "base64";
      body = buf.toString("base64");
    }
  } else {
    body = "";
  }

  const headersObject: Record<string, string> = {};
  for (const [key, value] of responseHeaders.entries()) {
    headersObject[key] = value;
  }

  const json = JSON.stringify({
    status: apiResponse.status,
    headers: headersObject,
    type: type,
    body: body,
  });
  res.header("content-type", "application/javascript");
  return res.send(`${callback}(${json})`);
};
