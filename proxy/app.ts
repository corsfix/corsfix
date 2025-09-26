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
import { validateProxyAccess } from "./middleware/access";

const MAX_JSONP_RESPONSE_SIZE = 3 * 1024 * 1024;

const decoder = new TextDecoder("utf-8", { fatal: true });

export const app = new Server({
  max_body_length: 10 * 1024 * 1024,
  fast_abort: true,
});

app.set_error_handler((req: Request, res: Response, error: Error) => {
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

app.use("/", validateProxyAccess);

app.any("/*", async (req: CorsfixRequest, res: Response) => {
  const targetUrl = req.ctx_url!;
  const callback = req.ctx_callback;

  const origin = req.ctx_origin!;
  const domain = req.ctx_domain!;

  req.ctx_cache = "x-corsfix-cache" in req.headers;

  const filteredHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey != "referer" &&
      lowerKey != "origin" &&
      !lowerKey.startsWith("sec-") &&
      !lowerKey.startsWith("x-corsfix-") &&
      !lowerKey.startsWith("x-forwarded-") &&
      !(callback && lowerKey === "accept-encoding")
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
    if (!isLocalDomain(domain)) {
      const application = await getApplication(domain);
      ({ url: processedUrl, headers: processedHeaders } = await processRequest(
        targetUrl,
        filteredHeaders,
        application?.id || null
      ));
    }

    const response = await proxyFetch(processedUrl, {
      method: req.method,
      headers: processedHeaders,
      redirect: "follow",
      body: ["GET", "HEAD"].includes(req.method)
        ? undefined
        : await req.buffer(),
      signal: AbortSignal.timeout(20000),
    });

    const responseHeaders = new Headers();
    for (const [key, value] of response.headers.entries()) {
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

    if (req.ctx_cache && !callback) {
      responseHeaders.delete("expires");
      responseHeaders.set("Cache-Control", "public, max-age=3600");
    }

    if (!callback) {
      // CORS request
      res.status(response.status);

      for (const [key, value] of responseHeaders.entries()) {
        res.header(key, value);
      }

      if (response.body) {
        const reader = response.body.getReader();
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
    } else {
      // JSONP request
      let body;
      let type: "json" | "text" | "base64" | "empty" = "empty";
      if (response.body) {
        const contentLength = response.headers.get("content-length");
        if (
          contentLength &&
          parseInt(contentLength) > MAX_JSONP_RESPONSE_SIZE
        ) {
          throw new Error("Response body too large for JSONP (max 3MB)");
        }

        const buf = await response.arrayBuffer();
        if (buf.byteLength > MAX_JSONP_RESPONSE_SIZE) {
          throw new Error("Response body too large for JSONP (max 3MB)");
        }

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
          body = Buffer.from(buf).toString("base64");
        }
      } else {
        body = "";
      }

      const headersObject: Record<string, string> = {};
      for (const [key, value] of responseHeaders.entries()) {
        headersObject[key] = value;
      }

      const json = JSON.stringify({
        status: response.status,
        headers: headersObject,
        type: type,
        body: body,
      });
      res.header("content-type", "application/javascript");
      return res.send(`${callback}(${json})`);
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
        console.error(error);
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
