import { MiddlewareNext, Response } from "hyper-express";
import { CorsfixRequest } from "../types/api";
import { batchCountMetrics } from "../lib/services/metricService";
import { getProxyRequest } from "../lib/util";
import { getRedisClient } from "../lib/services/cacheService";
import { IS_CLOUD } from "../config/constants";

export const handleMetrics = (
  req: CorsfixRequest,
  res: Response,
  next: MiddlewareNext
) => {
  res.on("close", () => {
    const { ctx_user_id, ctx_origin, ctx_bytes, ctx_cache } = req;

    if (ctx_user_id && ctx_origin && ctx_bytes) {
      if (IS_CLOUD && ctx_cache) {
        const url = getProxyRequest(req).url.href;
        const key = `metrics|${url}|${ctx_origin}`;

        const redisClient = getRedisClient();
        redisClient
          .get(key)
          .then(async (value) => {
            const metricsData = JSON.stringify({
              user_id: ctx_user_id,
              bytes: ctx_bytes,
            });

            await redisClient.set(key, metricsData, "EX", 2 * 60 * 60); // expire in 2 hours

            if (!value) {
              batchCountMetrics(ctx_user_id, ctx_origin, ctx_bytes);
            }
          })
          .catch((error) => {
            console.error(
              "Error fetching Redis during metrics handling.",
              error
            );
          });
        return;
      }

      batchCountMetrics(ctx_user_id, ctx_origin, ctx_bytes);
    }
  });
  next();
};
