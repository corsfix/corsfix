import { trialLimit } from "@/config/constants";
import { UserV2Entity } from "@/models/UserV2Entity";
import dbConnect from "../dbConnect";

export class TrialActivationError extends Error {}

// A stored end date at or above the cutoff means this account already used
// its manual trial. Anything below it predates manual activation.
export const isTrialUsed = (trialEndsAt: Date | undefined | null): boolean =>
  !!trialEndsAt && new Date(trialEndsAt) >= trialLimit.minEndsAt;

// Starts the one-time trial for an account. trial_ends_at doubles as the
// "already used" marker (see isTrialUsed), so it is never set twice.
export async function activateTrial(user_id: string): Promise<Date> {
  await dbConnect();

  const user = await UserV2Entity.findOne({ _id: user_id });
  if (!user) {
    throw new TrialActivationError("User not found");
  }
  if (user.subscription_active) {
    throw new TrialActivationError(
      "You already have an active plan, no trial needed."
    );
  }
  if (user.trial_ends_at && user.trial_ends_at > new Date()) {
    throw new TrialActivationError("Your trial is still active.");
  }
  if (isTrialUsed(user.trial_ends_at)) {
    throw new TrialActivationError("The trial has already been used.");
  }

  const trialEndsAt = new Date(
    Date.now() + trialLimit.days * 24 * 60 * 60 * 1000
  );
  user.trial_ends_at = trialEndsAt;
  await user.save();

  return trialEndsAt;
}
