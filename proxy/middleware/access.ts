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
import { sendCorsfixError } from "../errors";

const TEXT_ONLY_HOSTNAME = process.env.TEXT_ONLY_HOSTNAME;

const isTextOnlyRequest = (req: CorsfixRequest): boolean => {
  if (!TEXT_ONLY_HOSTNAME) return false;
  const host = req.header("host");
  if (!host) return false;
  // Strip port if present
  const hostname = host.split(":")[0];
  return hostname === TEXT_ONLY_HOSTNAME;
};

export const handleProxyAccess = async (req: CorsfixRequest, res: Response) => {
  const origin_domain = req.ctx_origin_domain!;
  const target_domain = req.ctx_target_domain!;
  const apiKey = req.header("x-corsfix-key");

  const textOnlyRequest = isTextOnlyRequest(req);
  req.ctx_text_only = textOnlyRequest;

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
        return sendCorsfixError(res, "invalid_api_key");
      }

      req.ctx_user_id = user.id;
    } else {
      const application = await getApplication(origin_domain);
      if (!application) {
        return sendCorsfixError(res, "domain_not_registered", {
          domain: origin_domain,
        });
      }
      if (!isDomainAllowed(target_domain, application.target_domains)) {
        return sendCorsfixError(res, "target_not_allowed", {
          domain: target_domain,
        });
      }

      user = await getUser(application.user_id);
      if (!user) {
        return sendCorsfixError(res, "user_not_found");
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
        return sendCorsfixError(res, "invalid_subscription");
      }

      const isTextOnlyPlan = !!product.textOnly;
      if (textOnlyRequest !== isTextOnlyPlan) {
        return sendCorsfixError(res, "plan_mismatch");
      }

      rpm = getRpmByProductId(product.id);
    } else if (isTrialActive(user)) {
      rpm = trialLimit.rpm;

      const metricsMtd = await getMonthToDateMetrics(req.ctx_user_id);
      if (metricsMtd.bytes >= trialLimit.bytes) {
        return sendCorsfixError(res, "trial_limit_reached");
      }
    } else {
      return sendCorsfixError(res, "trial_expired");
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
    return sendCorsfixError(res, "rate_limited");
  }
};
