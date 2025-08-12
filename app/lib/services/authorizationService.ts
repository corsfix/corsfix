import { freeTierLimit, IS_CLOUD } from "@/config/constants";
import { getActiveSubscription } from "./subscriptionService";
import { countApplication } from "./applicationService";
import { countSecret } from "./secretService";
import { AuthorizationResult } from "@/types/api";

export async function authorize(
  user_id: string,
  action: string
): Promise<AuthorizationResult> {
  switch (action) {
    case "add_applications":
      return await canAddApplications(user_id);
    case "add_secrets":
      return await canAddSecrets(user_id);
    default:
      return {
        allowed: false,
      };
  }
}

async function canAddApplications(
  user_id: string
): Promise<AuthorizationResult> {
  if (!IS_CLOUD) {
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

  // free tier
  const applicationCount = await countApplication(user_id);
  return {
    allowed: applicationCount < freeTierLimit.app_count,
    message: `Max ${freeTierLimit.app_count} applications on free tier. Upgrade for higher limits.`,
  };
}

async function canAddSecrets(user_id: string): Promise<AuthorizationResult> {
  if (!IS_CLOUD) {
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

  // free tier
  const secretCount = await countSecret(user_id);
  return {
    allowed: secretCount < freeTierLimit.secret_count,
    message: `Max ${freeTierLimit.secret_count} secret on free tier. Upgrade for higher limits.`,
  };
}
