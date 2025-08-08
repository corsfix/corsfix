import { Response } from "hyper-express";
import {
  getProxyRequest,
  getRpmByProductId,
  isLocalOrigin,
  isRegisteredOrigin,
} from "../lib/util";
import { CorsfixRequest, RateLimitConfig } from "../types/api";
import { getApplication } from "../lib/services/applicationService";
import { getActiveSubscription } from "../lib/services/subscriptionService";
import { checkRateLimit } from "../lib/services/ratelimitService";
import { IS_SELFHOST } from "../config/constants";

export const handleRateLimit = async (req: CorsfixRequest, res: Response) => {
  const origin = req.header("Origin");
  const domain = new URL(origin).hostname;
  const { url } = getProxyRequest(req);

  let rateLimitConfig: RateLimitConfig;

  if (isLocalOrigin(origin)) {
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
          `Corsfix: No application found for this domain (${domain}). Check the documentation for adding applications. (https://corsfix.com/docs/dashboard/application)`
        );
    }

    if (
      !application.target_domains.includes(url.hostname) &&
      !application.target_domains.includes("*")
    ) {
      return res
        .status(403)
        .end(
          `Corsfix: Target domain (${url.hostname}) not allowed. Check the documentation for adding target domains. (https://corsfix.com/docs/dashboard/application)`
        );
    }

    req.ctx_user_id = application.user_id;

    rateLimitConfig = {
      key: req.header("x-real-ip") || req.ip,
      rpm: 180,
      local: true,
    };
  } else if (isRegisteredOrigin(origin, url.href)) {
    rateLimitConfig = {
      key: origin,
      rpm: 60,
    };
  } else {
    const application = await getApplication(domain);

    if (!application) {
      return res
        .status(403)
        .end(
          `Corsfix: No application found for this domain (${domain}). Check the documentation for adding applications. (https://corsfix.com/docs/dashboard/application)`
        );
    }

    const activeSubscription = await getActiveSubscription(application.user_id);

    if (!activeSubscription) {
      return res
        .status(403)
        .end(
          "Corsfix: No active subscription found for this application. Subscribe to one of our plans to use the service. (https://app.corsfix.com/billing)"
        );
    }

    if (
      !application.target_domains.includes(url.hostname) &&
      !application.target_domains.includes("*")
    ) {
      return res
        .status(403)
        .end(
          `Corsfix: Target domain (${url.hostname}) not allowed. Check the documentation for adding target domains. (https://corsfix.com/docs/dashboard/application)`
        );
    }

    req.ctx_user_id = application.user_id;
    rateLimitConfig = {
      key: req.header("x-real-ip") || req.ip,
      rpm: getRpmByProductId(activeSubscription.product_id),
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
