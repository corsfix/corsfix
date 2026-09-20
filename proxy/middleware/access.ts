import { Response } from "hyper-express";
import {
  getClientIp,
  getRpmByProductId,
  isDomainAllowed,
  isLocalDomain,
  isTrialActive,
} from "../lib/util";
import { CorsfixRequest, FreeTier, RateLimitConfig } from "../types/api";
import { getApplication } from "../lib/services/applicationService";
import { getUserByApiKey } from "../lib/services/apiKeyService";
import { checkRateLimit } from "../lib/services/ratelimitService";
import {
  ALLOWED_ORIGINS,
  ALLOWED_TARGETS,
  DEFAULT_PROXY_HOSTNAME,
  IS_CLOUD,
  IS_SELFHOST,
  SELFHOST_RPM,
  TEXT_ONLY_HOSTNAME,
  freeTierLimit,
  trialLimit,
} from "../config/constants";
import { getUser } from "../lib/services/userService";
import { getMonthToDateMetrics } from "../lib/services/metricService";
import { getConfig } from "../lib/config";
import { sendCorsfixError } from "../errors";
import { admitFreeTierIp } from "../lib/services/concurrencyService";
import {
  getFreeTierByteLimit,
  getFreeTierBytes,
  recordFreeTierBytes,
} from "../lib/services/freeTierService";

const getHostname = (req: CorsfixRequest): string | undefined => {
  const host = req.header("host");
  if (!host) return undefined;
  return host.split(":")[0];
};

const isTextOnlyRequest = (req: CorsfixRequest): boolean => {
  if (!TEXT_ONLY_HOSTNAME) return false;
  return getHostname(req) === TEXT_ONLY_HOSTNAME;
};

const isDefaultProxy = (req: CorsfixRequest): boolean => {
  return getHostname(req) === DEFAULT_PROXY_HOSTNAME;
};

const isEnvAllowlisted = (origin_domain: string) =>
  IS_SELFHOST &&
  ALLOWED_ORIGINS.length > 0 &&
  ALLOWED_ORIGINS.includes(origin_domain);

// Free tier is only reachable through the SDK: the SDK is what renders the
// limit notice, so it is the only client that can turn a limit into a
// conversion path. The SDK marks its requests with `sdk=1` in the query
// string (a header would force a CORS preflight on every request).
const canUseFreeTier = (req: CorsfixRequest): boolean =>
  IS_CLOUD && req.query_parameters.sdk === "1";

// Runs the free tier checks for a request. Returns the error response when a
// limit is hit, otherwise marks the request as free tier and returns null.
const handleFreeTierAccess = async (
  req: CorsfixRequest,
  res: Response,
  tier: FreeTier
): Promise<Response | null> => {
  const origin_domain = req.ctx_origin_domain!;

  if (
    DEFAULT_PROXY_HOSTNAME &&
    !isDefaultProxy(req) &&
    !isTextOnlyRequest(req)
  ) {
    return sendCorsfixError(res, "region_not_allowed");
  }

  const limit = getFreeTierByteLimit(tier);
  const used = await getFreeTierBytes(origin_domain);
  if (used >= limit) {
    return sendCorsfixError(res, "free_tier_transfer_limit", {
      domain: origin_domain,
    });
  }

  const admitted = await admitFreeTierIp(
    origin_domain,
    getClientIp(req),
    freeTierLimit.concurrency
  );
  if (!admitted) {
    return sendCorsfixError(res, "free_tier_concurrency_limit");
  }

  req.ctx_free_tier = tier;
  req.ctx_free_tier_remaining = limit - used;

  res.once("close", () => {
    if (req.ctx_bytes) {
      recordFreeTierBytes(origin_domain, req.ctx_bytes);
    }
  });

  return null;
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
      key: getClientIp(req),
      rpm: 60,
      local: true,
    };
  } else if (isEnvAllowlisted(origin_domain)) {
    const allowedTargets =
      ALLOWED_TARGETS.length > 0 ? ALLOWED_TARGETS : ["*"];
    if (!isDomainAllowed(target_domain, allowedTargets)) {
      return sendCorsfixError(res, "target_not_allowed", {
        domain: target_domain,
      });
    }
    req.ctx_user_id = "env-allowlist";
    rateLimitConfig = {
      key: getClientIp(req),
      rpm: SELFHOST_RPM,
    };
  } else {
    let user;
    let application = null;
    if (apiKey) {
      user = await getUserByApiKey(apiKey);
      if (!user) {
        return sendCorsfixError(res, "invalid_api_key");
      }

      req.ctx_user_id = user.id;
    } else {
      application = await getApplication(origin_domain);
      if (!application) {
        if (!canUseFreeTier(req)) {
          return sendCorsfixError(res, "domain_not_registered", {
            domain: origin_domain,
          });
        }

        // Unregistered free tier: no account, no application. Only the
        // origin domain identifies this traffic.
        const error = await handleFreeTierAccess(req, res, "unregistered");
        if (error) return error;

        return applyRateLimit(req, res, {
          key: getClientIp(req),
          rpm: freeTierLimit.rpm,
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

      if (!isTextOnlyPlan) {
        const isRegionalRequest = !isDefaultProxy(req);
        const hasRegionSelection = user.feature_overrides?.regionSelection || product.regionSelection;
        if (isRegionalRequest && !hasRegionSelection) {
          return sendCorsfixError(res, "region_not_allowed");
        }
      }

      if (!user.feature_overrides?.noMinCacheTtl) {
        req.ctx_min_cache_ttl = product.minCacheTtlSeconds;
      }

      rpm = getRpmByProductId(product.id);
    } else if (isTrialActive(user)) {
      rpm = trialLimit.rpm;

      const metricsMtd = await getMonthToDateMetrics(req.ctx_user_id);
      if (metricsMtd.bytes >= trialLimit.bytes) {
        return sendCorsfixError(res, "trial_limit_reached");
      }
    } else if (application && canUseFreeTier(req)) {
      // Registered free tier: the domain is on an application but the
      // account has no active plan or trial.
      const error = await handleFreeTierAccess(req, res, "registered");
      if (error) return error;

      rpm = freeTierLimit.rpm;
    } else {
      // Registered domain, but no plan, no active trial, and no sdk=1 flag.
      return sendCorsfixError(res, "no_active_plan");
    }

    let rateLimitKey = getClientIp(req);
    if (product && product.rateLimitKey === "user_id") {
      rateLimitKey = user.id;
    }

    rateLimitConfig = {
      key: rateLimitKey,
      rpm: rpm,
    };
  }

  return applyRateLimit(req, res, rateLimitConfig);
};

const applyRateLimit = async (
  _req: CorsfixRequest,
  res: Response,
  rateLimitConfig: RateLimitConfig
) => {
  const { isAllowed, headers } = await checkRateLimit(rateLimitConfig);
  Object.entries(headers).forEach(([key, value]) => {
    res.header(key, value);
  });

  if (!isAllowed) {
    return sendCorsfixError(res, "rate_limited");
  }
};
