import { MiddlewareNext, Request, Response } from "hyper-express";
import { getProxyRequest } from "../lib/util";
import { batchCountMetrics } from "../lib/services/metricService";
import { getRedisClient } from "../lib/services/cacheService";
import { IS_CLOUD } from "../config/constants";

export const handlePreflight = (
  req: Request,
  res: Response,
  next: MiddlewareNext
) => {
  if (req.method === "OPTIONS") {
    const origin = req.header("Origin");
    res.header("Access-Control-Allow-Origin", origin);

    const requestMethod = req.header("Access-Control-Request-Method");
    if (requestMethod) {
      res.header("Access-Control-Allow-Methods", requestMethod);
    }

    const requestHeaders = req.header("Access-Control-Request-Headers");
    if (requestHeaders) {
      res.header("Access-Control-Allow-Headers", requestHeaders);

      if (
        IS_CLOUD &&
        requestHeaders
          .split(",")
          .map((h) => h.trim().toLowerCase())
          .find((h) => h === "x-corsfix-cache")
      ) {
        const url = getProxyRequest(req).url.href;
        const key = `metrics|${url}|${origin}`;

        const redisClient = getRedisClient();
        redisClient
          .get(key)
          .then(async (value) => {
            if (value) {
              const metricsData = JSON.parse(value);
              batchCountMetrics(metricsData.user_id, origin, metricsData.bytes);
              return;
            }
          })
          .catch((error) => {
            console.error("Error fetching Redis during preflight.", error);
          });
      }
    }

    return res.status(204).end();
  }
  next();
};
