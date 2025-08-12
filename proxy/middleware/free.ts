import { Response } from "hyper-express";
import { CorsfixRequest } from "../types/api";
import { getMonthToDateMetrics } from "../lib/services/metricService";
import { freeTierLimit } from "../config/constants";

export const handleFreeTier = async (req: CorsfixRequest, res: Response) => {
  const { ctx_user_id, ctx_free } = req;

  if (ctx_user_id && ctx_free) {
    const metricsMtd = await getMonthToDateMetrics(ctx_user_id);

    if (
      metricsMtd.req_count >= freeTierLimit.req_count ||
      metricsMtd.bytes >= freeTierLimit.bytes
    ) {
      return res
        .status(403)
        .end(
          `Corsfix: Free tier limits reached. Please upgrade to continue using the proxy. (https://app.corsfix.com/billing)`
        );
    }
  }
};
