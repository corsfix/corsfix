import { IS_SELFHOST, freeTierLimit, trialLimit } from "@/config/constants";
import { getActiveSubscription } from "./subscriptionService";
import { countApplication } from "./applicationService";
import { AuthorizationResult, PlanTier } from "@/types/api";
import { isTrialActive } from "../utils";
import { Session } from "next-auth";

export async function authorize(
  session: Session | null,
  action: string
): Promise<AuthorizationResult> {
  switch (action) {
    case "add_applications":
      return await canAddApplications(session);
    case "manage_secrets":
      return await canManageSecrets(session);
    default:
      return {
        allowed: false,
      };
  }
}

export async function getPlanTier(
  session: Session | null
): Promise<PlanTier | null> {
  if (!session?.user.id) {
    return null;
  }

  const subscription = await getActiveSubscription(session.user.id);
  if (subscription.active) {
    return "subscription";
  }
  if (isTrialActive(subscription.trial_ends_at)) {
    return "trial";
  }
  return "free";
}

async function canAddApplications(
  session: Session | null
): Promise<AuthorizationResult> {
  if (IS_SELFHOST) {
    return {
      allowed: true,
    };
  }

  if (!session?.user.id) {
    return {
      allowed: false,
    };
  }

  const subscription = await getActiveSubscription(session.user.id);
  const isTrial = isTrialActive(subscription.trial_ends_at);

  if (subscription.active) {
    return {
      allowed: true,
    };
  } else if (isTrial) {
    const applicationCount = await countApplication(session.user.id);
    return {
      allowed: applicationCount < trialLimit.app_count,
      message: `Max ${trialLimit.app_count} applications during trial. Upgrade for higher limits.`,
    };
  } else {
    // Free tier: one registered application per account. Other domains can
    // still use the proxy through the SDK with the unregistered allowance.
    const applicationCount = await countApplication(session.user.id);
    return {
      allowed: applicationCount < freeTierLimit.app_count,
      message: `The free tier includes ${freeTierLimit.app_count} application. Upgrade for more.`,
    };
  }
}

async function canManageSecrets(
  session: Session | null
): Promise<AuthorizationResult> {
  if (IS_SELFHOST) {
    return {
      allowed: true,
    };
  }

  if (!session?.user.id) {
    return {
      allowed: false,
    };
  }

  const subscription = await getActiveSubscription(session.user.id);
  const isTrial = isTrialActive(subscription.trial_ends_at);

  // Secrets are a Standard plan feature: not on Lite, not on the free tier.
  if (subscription.isLite) {
    return {
      allowed: false,
      message:
        "Secrets variables are not included in the Lite plan. Upgrade to a Standard plan to use this feature.",
    };
  }

  if (subscription.active || isTrial) {
    return {
      allowed: true,
    };
  } else {
    return {
      allowed: false,
      message:
        "Secrets variables are not available on the free tier. Upgrade to use this feature.",
    };
  }
}
