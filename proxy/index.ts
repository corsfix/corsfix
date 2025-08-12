import { MiddlewareNext, Request, Response, Server } from "hyper-express";
import {
  proxyFetch,
  getProxyRequest,
  isLocalOrigin,
  processRequest,
} from "./lib/util";
import dbConnect from "./lib/dbConnect";
import "dotenv/config";
import {
  getApplication,
  registerAppInvalidateCacheHandlers,
} from "./lib/services/applicationService";
import {
  validateOriginHeader,
  validatePayloadSize,
  validateUrl,
} from "./middleware/validation";
import { handlePreflight } from "./middleware/preflight";
import { handleRateLimit } from "./middleware/ratelimit";
import { handleMetrics } from "./middleware/metrics";
import { CorsfixRequest } from "./types/api";
import { registerMetricShutdownHandlers } from "./lib/services/metricService";
import { initRedis } from "./lib/services/cacheService";
import { initPubSub } from "./lib/services/pubSubService";
import { handleFreeTier } from "./middleware/free";

const PORT = 80;
const app = new Server({
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

app.use("/", validateOriginHeader);
app.use("/", validateUrl);

app.use("/", handlePreflight);

app.use("/", handleRateLimit);
app.use("/", handleFreeTier);

app.any("/*", async (req: CorsfixRequest, res: Response) => {
  const { url: targetUrl } = getProxyRequest(req);
  const origin = req.header("Origin");

  const hasCacheHeader = "x-corsfix-cache" in req.headers;
  req.ctx_cache = hasCacheHeader;

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
    if (!isLocalOrigin(origin)) {
      const domain = new URL(origin).hostname;
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

    responseHeaders.set("Access-Control-Allow-Origin", origin);
    responseHeaders.set("Access-Control-Expose-Headers", "*");

    responseHeaders.delete("content-encoding");
    responseHeaders.delete("transfer-encoding");

    responseHeaders.delete("set-cookie");
    responseHeaders.delete("set-cookie2");

    if (hasCacheHeader) {
      responseHeaders.delete("expires");
      responseHeaders.set("Cache-Control", "public, max-age=3600");
    }

    if (req.ctx_free || isLocalOrigin(origin)) {
      req.ctx_cache = false;
      responseHeaders.set("Cache-Control", "no-store");
    }

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

(async () => {
  await dbConnect();
  await initRedis();
  await initPubSub();

  registerMetricShutdownHandlers();
  registerAppInvalidateCacheHandlers();

  app
    .listen(PORT)
    .then(() => console.log(`Webserver started on port ${PORT}`))
    .catch((error) => console.error("Failed to start application.", error));
})();
