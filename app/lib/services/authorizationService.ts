import { freeTierLimit, IS_CLOUD } from "@/config/constants";
import { getActiveSubscription } from "./subscriptionService";
import { countApplication } from "./applicationService";
import { AuthorizationResult } from "@/types/api";

export async function authorize(
  user_id: string,
  action: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context?: any
): Promise<AuthorizationResult> {
  switch (action) {
    case "add_applications":
      return await canAddApplications(user_id);
    case "manage_secrets":
      return await canManageSecrets(user_id, context);
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

async function canManageSecrets(
  user_id: string,
  context: { newSecretsCount: number }
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

  // Free tier validation: only allow 1 secret in the request
  if (context.newSecretsCount > freeTierLimit.secret_count) {
    return {
      allowed: false,
      message: `Max ${freeTierLimit.secret_count} secrets per app on free tier. You're trying to add ${context.newSecretsCount} secrets. Upgrade for higher limits.`,
    };
  }

  return {
    allowed: true,
  };
}
