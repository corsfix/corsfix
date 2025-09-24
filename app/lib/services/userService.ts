import { User } from "@/types/api";
import dbConnect from "../dbConnect";
import { UserV2Entity } from "@/models/UserV2Entity";

export async function getUser(email: string): Promise<User | null> {
  await dbConnect();
  const user = await UserV2Entity.findOne({ email: email }).lean();

  if (!user) {
    return null;
  }

  return {
    id: user._id.toString(),
    email: user.email,
  };
}

export async function isUserOnActiveTrial(user_id: string): Promise<boolean> {
  await dbConnect();
  const user = await UserV2Entity.findById(user_id).lean();

  if (!user || !user.trial_ends_at) {
    return false;
  }

  return new Date() < new Date(user.trial_ends_at);
}
