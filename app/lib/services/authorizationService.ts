import { IS_CLOUD } from "@/config/constants";
import dbConnect from "../dbConnect";
import { getActiveSubscription } from "./subscriptionService";

export async function authorize(user_id: string, action: string) {
  switch (action) {
    case "manage_applications":
      return await canManageApplications(user_id);
    case "manage_secrets":
      return await canManageSecrets(user_id);
    default:
      return false;
  }
}

async function canManageApplications(user_id: string) {
  if (!IS_CLOUD) {
    return true;
  }

  await dbConnect();

  const subscription = await getActiveSubscription(user_id);
  return subscription.active;
}

async function canManageSecrets(user_id: string) {
  if (!IS_CLOUD) {
    return true;
  }
  
  await dbConnect();

  const subscription = await getActiveSubscription(user_id);
  return subscription.active;
}
