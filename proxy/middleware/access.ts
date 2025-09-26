import { Response } from "hyper-express";
import { getRpmByProductId, isDomainAllowed, isLocalDomain } from "../lib/util";
import { CorsfixRequest, RateLimitConfig } from "../types/api";
import { getApplication } from "../lib/services/applicationService";
import { getActiveSubscription } from "../lib/services/subscriptionService";
import { checkRateLimit } from "../lib/services/ratelimitService";
import { IS_SELFHOST, trialLimit } from "../config/constants";
import { isTrialActive } from "../lib/services/userService";
import { getMonthToDateMetrics } from "../lib/services/metricService";

export const validateProxyAccess = async (
  req: CorsfixRequest,
  res: Response
) => {
  const domain = req.ctx_domain!;

  let rateLimitConfig: RateLimitConfig;

  if (isLocalDomain(domain)) {
    rateLimitConfig = {
      key: req.header("x-real-ip") || req.ip,
      rpm: 60,
      local: true,
    };
  } else if (IS_SELFHOST) {
    const application = await getApplication(domain);
    if (!application) {
      return res
        .status(403)
        .end(
          `Corsfix: Please add your website domain (${domain}) to the dashboard to use the CORS proxy. (https://corsfix.com/docs/dashboard/application)`
        );
    }
    req.ctx_user_id = application.user_id;

    if (isDomainAllowed(domain, application.target_domains)) {
      return res
        .status(403)
        .end(
          `Corsfix: Target domain (${domain}) not allowed. Check the documentation for adding target domains. (https://corsfix.com/docs/dashboard/application)`
        );
    }

    rateLimitConfig = {
      key: req.header("x-real-ip") || req.ip,
      rpm: 180,
      local: true,
    };
  } else {
    const application = await getApplication(domain);
    if (!application) {
      return res
        .status(403)
        .end(
          `Corsfix: Please add your website domain (${domain}) to the dashboard to use the CORS proxy. (https://corsfix.com/docs/dashboard/application)`
        );
    }
    req.ctx_user_id = application.user_id;

    let rpm;
    const activeSubscription = await getActiveSubscription(application.user_id);
    if (activeSubscription) {
      rpm = getRpmByProductId(activeSubscription.product_id);
    } else {
      const isTrial = await isTrialActive(application.user_id);
      if (!isTrial) {
        return res
          .status(403)
          .end(
            `Corsfix: Trial period ended. Please upgrade to continue using the proxy. (https://app.corsfix.com/billing)`
          );
      }

      const metricsMtd = await getMonthToDateMetrics(application.user_id);
      if (metricsMtd.bytes >= trialLimit.bytes) {
        return res
          .status(403)
          .end(
            `Corsfix: Trial limits reached. Please upgrade to continue using the proxy. (https://app.corsfix.com/billing)`
          );
      }

      rpm = trialLimit.rpm;
    }

    if (isDomainAllowed(domain, application.target_domains)) {
      return res
        .status(403)
        .end(
          `Corsfix: Target domain (${domain}) not allowed. Check the documentation for adding target domains. (https://corsfix.com/docs/dashboard/application)`
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
