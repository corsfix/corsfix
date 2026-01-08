import { MiddlewareNext, Request, Response, Server } from "hyper-express";
import { processRequest, isLocalDomain, proxyRequest } from "./lib/util";
import { getApplication } from "./lib/services/applicationService";
import {
  validateJsonpRequest,
  validateOriginHeader,
  validatePayloadSize,
  validateTargetUrl,
} from "./middleware/validation";
import { detectApiKeyRequest } from "./middleware/apiKey";
import { handlePreflight } from "./middleware/preflight";
import { handleMetrics } from "./middleware/metrics";
import { CorsfixRequest } from "./types/api";
import { handleProxyAccess } from "./middleware/access";
import { Dispatcher } from "undici";
import { compressTextResponse } from "./lib/compression";
import { sendCorsfixError } from "./errors";
import { Readable, Transform } from "stream";

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
  sendCorsfixError(res, "uncaught_error");
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
app.use("/", detectApiKeyRequest);
app.use("/", validateOriginHeader);

app.use("/", handlePreflight);

app.use("/", handleProxyAccess);

app.any("/*", async (req: CorsfixRequest, res: Response) => {
  const targetUrl = req.ctx_url!;
  const callback = req.ctx_callback;

  const origin = req.ctx_origin!;
  const origin_domain = req.ctx_origin_domain!;
  const api_key_request = req.ctx_api_key_request!;

  req.ctx_cached_request = "x-corsfix-cache" in req.headers;

  const filteredHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey != "referer" &&
      lowerKey != "origin" &&
      lowerKey != "host" &&
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
    if (!isLocalDomain(origin_domain) && !api_key_request) {
      const application = await getApplication(origin_domain);
      ({ url: processedUrl, headers: processedHeaders } = await processRequest(
        targetUrl,
        filteredHeaders,
        application?.id || null
      ));
    }

    const enableDecompression = !!(callback || TEXT_ONLY);
    let apiResponse = await proxyRequest(processedUrl, {
      method: req.method,
      headers: processedHeaders,
      body: ["GET", "HEAD"].includes(req.method)
        ? undefined
        : await req.buffer(),
      signal: AbortSignal.timeout(20000),
      decompress: enableDecompression,
      maxRedirects: 5,
    });

    const responseHeaders = new Headers();
    for (const [key, value] of Object.entries(apiResponse.headers)) {
      if (value != null) responseHeaders.set(key, value.toString());
    }

    if (!callback) {
      responseHeaders.set("Access-Control-Allow-Origin", origin);
      responseHeaders.set("Access-Control-Expose-Headers", "*");
    }

    responseHeaders.delete("transfer-encoding");

    const setCookies = responseHeaders.getSetCookie();
    if (setCookies.length > 0) {
      responseHeaders.delete("set-cookie");
      for (const cookie of setCookies) {
        responseHeaders.append("x-corsfix-set-cookie", cookie);
      }
    }

    if (req.ctx_cached_request && !callback) {
      responseHeaders.delete("expires");
      responseHeaders.set("Cache-Control", "public, max-age=3600");
    }

    if (callback) {
      jsonpHandler(req, res, callback, apiResponse, responseHeaders);
    } else if (TEXT_ONLY) {
      textOnlyHandler(req, res, apiResponse, responseHeaders);
    } else {
      corsHandler(req, res, apiResponse, responseHeaders);
    }
  } catch (error: unknown) {
    const { name, message, cause } = error as Error;
    if (name === "AbortError" || name === "TimeoutError") {
      sendCorsfixError(res, "timeout");
    } else if (message === "fetch failed") {
      if ((cause as any).code === "ENOTFOUND") {
        sendCorsfixError(res, "target_not_found");
      } else {
        console.error("Fetch error occurred.", error);
        sendCorsfixError(res, "target_unreachable");
      }
    } else {
      console.error("Unknown error occurred.", error);
      sendCorsfixError(res, "unknown_error");
    }
  }
});

const corsHandler = async (
  req: CorsfixRequest,
  res: Response,
  apiResponse: Dispatcher.ResponseData<any>,
  responseHeaders: Headers
) => {
  // CORS request
  res.status(apiResponse.statusCode);
  res.header("X-Corsfix-Status", "success", true);

  for (const [key, value] of responseHeaders.entries()) {
    res.header(key, value);
  }

  if (apiResponse.body) {
    const contentLengthHeader =
      apiResponse.headers["content-length"]?.toString();
    let contentLength: number | undefined = undefined;
    if (contentLengthHeader !== undefined) {
      const parsedLength = parseInt(contentLengthHeader, 10);
      if (Number.isFinite(parsedLength) && parsedLength > 0) {
        contentLength = parsedLength;
      }
    }

    let bytes = 0;
    const counter = new Transform({
      transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        callback(null, chunk);
      },
    });

    const readable = Readable.from(apiResponse.body).pipe(counter);
    await res.stream(readable, contentLength);
    req.ctx_bytes = bytes;
    return;
  }

  return res.end();
};

const textOnlyHandler = async (
  req: CorsfixRequest,
  res: Response,
  apiResponse: Dispatcher.ResponseData<any>,
  responseHeaders: Headers
) => {
  // check Content-Length
  const contentLengthHeader = apiResponse.headers["content-length"]?.toString();
  const contentLength = contentLengthHeader
    ? parseInt(contentLengthHeader, 10)
    : null;
  if (
    contentLength !== null &&
    !isNaN(contentLength) &&
    contentLength > ONE_MEGABYTE
  ) {
    return sendCorsfixError(res, "response_too_large");
  }

  res.status(apiResponse.statusCode);
  res.header("X-Corsfix-Status", "success", true);

  if (apiResponse.body) {
    let bytes = 0;
    const chunks: Uint8Array[] = [];

    for await (const value of apiResponse.body) {
      chunks.push(value);
      bytes += value.length;

      // Check if we exceeded size limit
      if (bytes > ONE_MEGABYTE) {
        return sendCorsfixError(res, "response_too_large");
      }
    }

    req.ctx_bytes = bytes;

    const fullResponse = Buffer.concat(chunks);

    // Try to decode as text
    try {
      const text = decoder.decode(fullResponse);
      const compression = compressTextResponse(
        req.header("accept-encoding"),
        text,
        responseHeaders.get("content-type")
      );

      responseHeaders.set("Content-Type", compression.contentType);
      responseHeaders.delete("content-length");

      if (compression.contentEncoding) {
        responseHeaders.set("Content-Encoding", compression.contentEncoding);
      } else {
        responseHeaders.delete("content-encoding");
      }

      for (const [key, value] of responseHeaders.entries()) {
        res.header(key, value);
      }

      return res.send(compression.compressed);
    } catch (error) {
      return sendCorsfixError(res, "response_not_text");
    }
  }

  return res.end();
};

const jsonpHandler = async (
  req: CorsfixRequest,
  res: Response,
  callback: string,
  apiResponse: Dispatcher.ResponseData<any>,
  responseHeaders: Headers
) => {
  let body;
  let type: "json" | "text" | "base64" | "empty" = "empty";
  if (apiResponse.body) {
    const contentLengthHeader =
      apiResponse.headers["content-length"]?.toString();
    const contentLength = contentLengthHeader
      ? parseInt(contentLengthHeader, 10)
      : null;
    if (
      contentLength !== null &&
      !isNaN(contentLength) &&
      contentLength > ONE_MEGABYTE
    ) {
      return sendCorsfixError(res, "response_too_large");
    }

    let bytes = 0;
    const chunks: Uint8Array[] = [];

    for await (const value of apiResponse.body) {
      chunks.push(value);
      bytes += value.length;

      // Check if we exceeded size limit
      if (bytes > ONE_MEGABYTE) {
        return sendCorsfixError(res, "response_too_large");
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
    status: apiResponse.statusCode,
    headers: headersObject,
    type: type,
    body: body,
  });
  const text = `${callback}(${json})`;
  const compression = compressTextResponse(
    req.header("accept-encoding"),
    text,
    "application/javascript; charset=utf-8"
  );

  res.header("X-Corsfix-Status", "success", true);
  res.header("content-type", compression.contentType);
  if (compression.contentEncoding) {
    res.header("content-encoding", compression.contentEncoding);
  } else {
    res.removeHeader("content-encoding");
  }

  return res.send(compression.compressed);
};
