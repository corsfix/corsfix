import { Response } from "hyper-express";
import { CorsfixRequest } from "../types/api";
import { getMonthToDateMetrics } from "../lib/services/metricService";

export const handleFreeTier = async (req: CorsfixRequest, res: Response) => {
  const { ctx_user_id, ctx_free } = req;

  if (ctx_user_id && ctx_free) {
    const metricsMtd = await getMonthToDateMetrics(ctx_user_id);

    if (metricsMtd.req_count >= 500 || metricsMtd.bytes >= 50_000_000) {
      return res
        .status(403)
        .end(
          `Corsfix: Free tier limits reached. Please upgrade to continue using the proxy. (https://app.corsfix.com/billing)`
        );
    }
  }
};
