import { IS_CLOUD } from "@/config/constants";
import { getActiveSubscription } from "./subscriptionService";
import { countApplication } from "./applicationService";
import { countSecret } from "./secretService";

export async function authorize(user_id: string, action: string) {
  switch (action) {
    case "add_applications":
      return await canAddApplications(user_id);
    case "add_secrets":
      return await canAddSecrets(user_id);
    default:
      return false;
  }
}

async function canAddApplications(user_id: string) {
  if (!IS_CLOUD) {
    return true;
  }

  const subscription = await getActiveSubscription(user_id);

  if (subscription.active) {
    return true;
  }

  // free tier
  const applicationCount = await countApplication(user_id);
  return applicationCount < 1;
}

async function canAddSecrets(user_id: string) {
  if (!IS_CLOUD) {
    return true;
  }

  const subscription = await getActiveSubscription(user_id);

  if (subscription.active) {
    return true;
  }

  // free tier
  const secretCount = await countSecret(user_id);
  return secretCount < 1;
}
