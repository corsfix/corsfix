import { IS_CLOUD, freeTierLimit, trialLimit } from "@/config/constants";
import { getActiveSubscription } from "@/lib/services/subscriptionService";
import { getProxyDomain, isTrialActive } from "@/lib/utils";
import { McpAccount } from "./context";

export type Region = "auto" | "ap" | "us" | "eu";

export interface PlanInfo {
  tier: "subscription" | "trial" | "free" | "self_hosted";
  name: string;
  isLite: boolean;
  trialEndsAt?: string;
  secretsAvailable: boolean;
  regionSelection: boolean;
  cacheMinimum?: string;
  maxApplications: number | "unlimited";
  maxOriginsPerApplication: number;
  bandwidthBytes?: number;
}

export async function getPlanInfo(account: McpAccount): Promise<PlanInfo> {
  if (!IS_CLOUD) {
    return {
      tier: "self_hosted",
      name: "Self-hosted",
      isLite: false,
      secretsAvailable: true,
      regionSelection: false,
      maxApplications: "unlimited",
      maxOriginsPerApplication: 8,
    };
  }

  const subscription = await getActiveSubscription(account.userId);

  if (subscription.active) {
    const family = subscription.family;
    return {
      tier: "subscription",
      name: subscription.label || subscription.name,
      isLite: !!subscription.isLite,
      secretsAvailable: !subscription.isLite,
      regionSelection:
        !!subscription.regionSelection ||
        family === "growth" ||
        family === "scale",
      cacheMinimum:
        subscription.noMinCacheTtl || family === "scale"
          ? undefined
          : family === "growth"
          ? "1m"
          : family === "hobby"
          ? "10m"
          : undefined,
      maxApplications: "unlimited",
      maxOriginsPerApplication: 8,
      bandwidthBytes: subscription.bandwidth || undefined,
    };
  }

  if (isTrialActive(subscription.trial_ends_at)) {
    return {
      tier: "trial",
      name: "Trial",
      isLite: false,
      trialEndsAt: new Date(subscription.trial_ends_at!).toISOString(),
      secretsAvailable: true,
      regionSelection: false,
      maxApplications: trialLimit.app_count,
      maxOriginsPerApplication: 8,
      bandwidthBytes: trialLimit.bytes,
    };
  }

  return {
    tier: "free",
    name: "Free",
    isLite: false,
    secretsAvailable: false,
    regionSelection: false,
    maxApplications: freeTierLimit.app_count,
    maxOriginsPerApplication: freeTierLimit.origin_count,
    bandwidthBytes: freeTierLimit.registeredBytes,
  };
}

// Base URL of the proxy this account should call, following the same rules
// as the dashboard playground: self-hosted instances use their own proxy
// domain, Lite plans use lite.corsfix.com, and regional endpoints are opt-in.
export const getProxyBaseUrl = (plan: PlanInfo, region: Region = "auto") => {
  if (!IS_CLOUD) {
    const domain = getProxyDomain();
    return domain ? `https://${domain}` : "https://proxy.corsfix.com";
  }
  if (plan.isLite) return "https://lite.corsfix.com";
  if (region !== "auto") return `https://proxy-${region}.corsfix.com`;
  return "https://proxy.corsfix.com";
};
