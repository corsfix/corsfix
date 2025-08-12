import { IS_CLOUD } from "@/config/constants";
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
    allowed: applicationCount < 3,
    message: "Max 3 applications on free tier. Upgrade for higher limits.",
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
    allowed: secretCount < 1,
    message: "Max 1 secret on free tier. Upgrade for higher limits.",
  };
}
