import { freeTierLimit, IS_SELFHOST } from "@/config/constants";
import { getActiveSubscription } from "./subscriptionService";
import { countApplication } from "./applicationService";
import { AuthorizationResult } from "@/types/api";
import { isUserOnActiveTrial } from "./userService";

export async function authorize(
  user_id: string,
  action: string
): Promise<AuthorizationResult> {
  switch (action) {
    case "add_applications":
      return await canAddApplications(user_id);
    case "manage_secrets":
      return await canManageSecrets(user_id);
    default:
      return {
        allowed: false,
      };
  }
}

async function canAddApplications(
  user_id: string
): Promise<AuthorizationResult> {
  if (IS_SELFHOST) {
    return {
      allowed: true,
    };
  }

  const subscription = await getActiveSubscription(user_id);

  if (subscription.active) {
    return {
      allowed: true,
    };
  }

  // Check if user is on active trial
  const onTrial = await isUserOnActiveTrial(user_id);

  if (!onTrial) {
    return {
      allowed: false,
      message:
        "Trial has ended. Please subscribe to continue using the service.",
    };
  }

  // During trial, check app count limit
  const applicationCount = await countApplication(user_id);
  return {
    allowed: applicationCount < freeTierLimit.app_count,
    message: `Max ${freeTierLimit.app_count} applications during trial. Upgrade for higher limits.`,
  };
}

async function canManageSecrets(user_id: string): Promise<AuthorizationResult> {
  if (IS_SELFHOST) {
    return {
      allowed: true,
    };
  }

  const subscription = await getActiveSubscription(user_id);

  if (subscription.active) {
    return {
      allowed: true,
    };
  }

  // Check if user is on active trial
  const onTrial = await isUserOnActiveTrial(user_id);

  if (!onTrial) {
    return {
      allowed: false,
      message:
        "Trial has ended. Please subscribe to continue using the service.",
    };
  }

  // During trial, allow secrets management
  return {
    allowed: true,
  };
}
