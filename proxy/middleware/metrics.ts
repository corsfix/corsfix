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
    const { ctx_user_id, ctx_bytes, ctx_cache_duration } = req;
    const origin_domain = req.ctx_origin_domain!;

    if (ctx_user_id && ctx_bytes) {
      if (IS_CLOUD && ctx_cache_duration) {
        const url = getProxyRequest(req).url.href;
        const key = `metrics|${url}|${origin_domain}`;

        const redisClient = getRedisClient();
        redisClient
          .get(key)
          .then(async (value) => {
            const metricsData = JSON.stringify({
              user_id: ctx_user_id,
              bytes: ctx_bytes,
            });

            await redisClient.set(key, metricsData, "EX", 2 * ctx_cache_duration);

            if (!value) {
              batchCountMetrics(ctx_user_id, origin_domain, ctx_bytes);
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

      batchCountMetrics(ctx_user_id, origin_domain, ctx_bytes);
    }
  });
  next();
};
