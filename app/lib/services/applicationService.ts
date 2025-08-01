import { ApplicationEntity } from "@/models/ApplicationEntity";
import { Application, UpsertApplication } from "@/types/api";
import dbConnect from "../dbConnect";
import redisConnect from "../redisConnect";
import { deleteSecretsForApplication } from "./secretService";

export async function getApplications(user_id: string): Promise<Application[]> {
  await dbConnect();

  const applications = await ApplicationEntity.find({
    user_id: user_id,
  }).lean();

  return applications.map((application) => ({
    id: application._id.toString(),
    name: application.name,
    originDomains: application.origin_domains,
    targetDomains: application.target_domains,
  }));
}

export async function createApplication(
  user_id: string,
  { name, originDomains, targetDomains }: UpsertApplication
): Promise<Application> {
  await dbConnect();

  const application = new ApplicationEntity({
    user_id: user_id,
    name: name,
    origin_domains: originDomains,
    target_domains: targetDomains,
  });

  await application.save();

  const redis = await redisConnect();
  redis.publish("app-invalidate", JSON.stringify(application.origin_domains));

  return {
    id: application._id as string,
    name: name,
    originDomains: application.origin_domains,
    targetDomains: application.target_domains,
  };
}

export async function hasApplicationWithOrigins(
  exclude_id: string | null,
  origins: string[]
): Promise<string[]> {
  await dbConnect();

  const application = await ApplicationEntity.findOne({
    origin_domains: { $in: origins },
    ...(exclude_id ? { _id: { $ne: exclude_id } } : {}),
  }).select("origin_domains");

  if (!application) {
    return [];
  }

  return application.origin_domains.filter((origin) =>
    origins.includes(origin)
  );
}

export async function updateApplication(
  user_id: string,
  id: string,
  { name, originDomains, targetDomains }: UpsertApplication
): Promise<Application> {
  await dbConnect();

  const application = await ApplicationEntity.findOne({
    user_id: user_id,
    _id: id,
  });

  if (!application) {
    throw new Error("Application not found");
  }

  application.name = name;
  application.origin_domains = originDomains;
  application.target_domains = targetDomains;

  await application.save();

  const redis = await redisConnect();
  redis.publish("app-invalidate", JSON.stringify(application.origin_domains));

  return {
    id: application._id as string,
    name: name,
    originDomains: originDomains,
    targetDomains: targetDomains,
  };
}

export async function deleteApplication(user_id: string, id: string) {
  await dbConnect();

  const application = await ApplicationEntity.findOne({
    user_id: user_id,
    _id: id,
  });

  if (!application) {
    throw new Error("Application not found");
  }

  const redis = await redisConnect();
  redis.publish("app-invalidate", JSON.stringify(application.origin_domains));

  // Delete all secrets associated with this application
  await deleteSecretsForApplication(user_id, id);

  await application.deleteOne();
}
