import { IS_SELFHOST, trialLimit } from "@/config/constants";
import { getActiveSubscription } from "./subscriptionService";
import { countApplication } from "./applicationService";
import { AuthorizationResult } from "@/types/api";
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
  const isTrial = isTrialActive(session);

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
    return {
      allowed: false,
      message: "Please upgrade to continue using Corsfix.",
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
  const isTrial = isTrialActive(session);

  if (subscription.active || isTrial) {
    return {
      allowed: true,
    };
  } else {
    return {
      allowed: false,
      message: "Please upgrade to continue using Corsfix.",
    };
  }
}
