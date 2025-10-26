import { Response } from "hyper-express";
import {
  getRpmByProductId,
  isDomainAllowed,
  isLocalDomain,
  isTrialActive,
} from "../lib/util";
import { CorsfixRequest, RateLimitConfig } from "../types/api";
import { getApplication } from "../lib/services/applicationService";
import { checkRateLimit } from "../lib/services/ratelimitService";
import { IS_SELFHOST, trialLimit } from "../config/constants";
import { getUser } from "../lib/services/userService";
import { getMonthToDateMetrics } from "../lib/services/metricService";

export const handleProxyAccess = async (req: CorsfixRequest, res: Response) => {
  const origin_domain = req.ctx_origin_domain!;
  const target_domain = req.ctx_target_domain!;

  let rateLimitConfig: RateLimitConfig;

  if (isLocalDomain(origin_domain)) {
    rateLimitConfig = {
      key: req.header("x-real-ip") || req.ip,
      rpm: 60,
      local: true,
    };
  } else {
    const application = await getApplication(origin_domain);
    if (!application) {
      return res
        .status(403)
        .end(
          `Corsfix: Please add your website domain (${origin_domain}) to the dashboard to use the CORS proxy. (https://corsfix.com/docs/dashboard/application)`
        );
    }
    if (!isDomainAllowed(target_domain, application.target_domains)) {
      return res
        .status(403)
        .end(
          `Corsfix: Target domain (${target_domain}) not allowed. Check the documentation for adding target domains. (https://corsfix.com/docs/dashboard/application)`
        );
    }

    const user = await getUser(application.user_id);
    if (!user) {
      return res.status(403).end(`Corsfix: User not found!`);
    }
    req.ctx_user_id = application.user_id;

    let rpm;
    if (IS_SELFHOST) {
      rpm = 180;
    } else if (user.subscription_active && user.subscription_product_id) {
      rpm = getRpmByProductId(user.subscription_product_id);
    } else if (isTrialActive(user)) {
      rpm = trialLimit.rpm;

      const metricsMtd = await getMonthToDateMetrics(application.user_id);
      if (metricsMtd.bytes >= trialLimit.bytes) {
        return res
          .status(403)
          .end(
            `Corsfix: Your trial limit has been reached. Please upgrade to continue using the proxy. (https://app.corsfix.com/billing)`
          );
      }
    } else {
      return res
        .status(403)
        .end(
          `Corsfix: Your trial period has ended. Please upgrade to continue using the proxy. (https://app.corsfix.com/billing)`
        );
    }

    rateLimitConfig = {
      key: req.header("x-real-ip") || req.ip,
      rpm: rpm,
    };
  }

  const { isAllowed, headers } = await checkRateLimit(rateLimitConfig);
  Object.entries(headers).forEach(([key, value]) => {
    res.header(key, value);
  });

  if (!isAllowed) {
    return res.status(429).end("Corsfix: Too Many Requests.");
  }
};
