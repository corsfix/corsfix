import { Response } from "hyper-express";
import {
  getRpmByProductId,
  isDomainAllowed,
  isLocalDomain,
  isTrialActive,
} from "../lib/util";
import { CorsfixRequest, RateLimitConfig } from "../types/api";
import { getApplication } from "../lib/services/applicationService";
import { getUserByApiKey } from "../lib/services/apiKeyService";
import { checkRateLimit } from "../lib/services/ratelimitService";
import { IS_SELFHOST, SELFHOST_RPM, trialLimit } from "../config/constants";
import { getUser } from "../lib/services/userService";
import { getMonthToDateMetrics } from "../lib/services/metricService";
import { getConfig } from "../lib/config";

export const handleProxyAccess = async (req: CorsfixRequest, res: Response) => {
  const origin_domain = req.ctx_origin_domain!;
  const target_domain = req.ctx_target_domain!;
  const apiKey = req.header("x-corsfix-key");

  let rateLimitConfig: RateLimitConfig;

  if (isLocalDomain(origin_domain)) {
    rateLimitConfig = {
      key: req.header("x-real-ip") || req.ip,
      rpm: 60,
      local: true,
    };
  } else {
    let user;
    if (apiKey) {
      user = await getUserByApiKey(apiKey);
      if (!user) {
        res.header("X-Corsfix-Status", "invalid_api_key", true);
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Expose-Headers", "*");
        return res.status(403).end("Corsfix: Invalid API key.");
      }

      req.ctx_user_id = user.id;
    } else {
      const application = await getApplication(origin_domain);
      if (!application) {
        res.header("X-Corsfix-Status", "domain_not_registered", true);
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Expose-Headers", "*");
        return res
          .status(403)
          .end(
            `Corsfix: Please add your website domain (${origin_domain}) to the dashboard to use the CORS proxy. (https://corsfix.com/docs/dashboard/application)`
          );
      }
      if (!isDomainAllowed(target_domain, application.target_domains)) {
        res.header("X-Corsfix-Status", "target_not_allowed", true);
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Expose-Headers", "*");
        return res
          .status(403)
          .end(
            `Corsfix: Target domain (${target_domain}) not allowed. Check the documentation for adding target domains. (https://corsfix.com/docs/dashboard/application)`
          );
      }

      user = await getUser(application.user_id);
      if (!user) {
        res.header("X-Corsfix-Status", "user_not_found", true);
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Expose-Headers", "*");
        return res.status(403).end(`Corsfix: User not found!`);
      }
      req.ctx_user_id = application.user_id;
    }

    const config = getConfig();
    let product = null;
    let rpm;
    if (IS_SELFHOST) {
      rpm = SELFHOST_RPM;
    } else if (user.subscription_active && user.subscription_product_id) {
      product = config.products.find(
        (p) => p.id === user.subscription_product_id
      );
      if (!product) {
        res.header("X-Corsfix-Status", "invalid_subscription", true);
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Expose-Headers", "*");
        return res
          .status(400)
          .end(
            `Corsfix: Subscription product ID '${user.subscription_product_id}' not found in configuration.`
          );
      }
      rpm = getRpmByProductId(product.id);
    } else if (isTrialActive(user)) {
      rpm = trialLimit.rpm;

      const metricsMtd = await getMonthToDateMetrics(req.ctx_user_id);
      if (metricsMtd.bytes >= trialLimit.bytes) {
        res.header("X-Corsfix-Status", "trial_limit_reached", true);
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Expose-Headers", "*");
        return res
          .status(403)
          .end(
            `Corsfix: Your trial limit has been reached. Please upgrade to continue using the proxy. (https://app.corsfix.com/billing)`
          );
      }
    } else {
      res.header("X-Corsfix-Status", "trial_expired", true);
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Expose-Headers", "*");
      return res
        .status(403)
        .end(
          `Corsfix: Your trial period has ended. Please upgrade to continue using the proxy. (https://app.corsfix.com/billing)`
        );
    }

    let rateLimitKey = req.header("x-real-ip") || req.ip;
    if (product && product.rateLimitKey === "user_id") {
      rateLimitKey = user.id;
    }

    rateLimitConfig = {
      key: rateLimitKey,
      rpm: rpm,
    };
  }

  const { isAllowed, headers } = await checkRateLimit(rateLimitConfig);
  Object.entries(headers).forEach(([key, value]) => {
    res.header(key, value);
  });

  if (!isAllowed) {
    res.header("X-Corsfix-Status", "rate_limited", true);
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Expose-Headers", "*");
    return res.status(429).end("Corsfix: Too Many Requests.");
  }
};
