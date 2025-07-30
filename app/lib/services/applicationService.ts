import { ApplicationEntity } from "@/models/ApplicationEntity";
import { Application, UpsertApplication } from "@/types/api";
import dbConnect from "../dbConnect";
import { deleteSecretsForApplication } from "./secretService";

export async function getApplications(user_id: string): Promise<Application[]> {
  await dbConnect();

  const applications = await ApplicationEntity.find({
    user_id: user_id,
  }).lean();

  return applications.map((application) => ({
    id: application._id.toString(),
    name: application.name,
    allowedOrigins: application.allowed_origins,
    allowedUrls: application.allowed_urls,
  }));
}

export async function createApplication(
  user_id: string,
  { name, allowedOrigins, allowedUrls }: UpsertApplication
): Promise<Application> {
  await dbConnect();

  const application = new ApplicationEntity({
    user_id: user_id,
    name: name,
    allowed_origins: allowedOrigins,
    allowed_urls: allowedUrls,
  });

  await application.save();

  return {
    id: application._id as string,
    name: name,
    allowedOrigins: application.allowed_origins,
    allowedUrls: application.allowed_urls,
  };
}

export async function hasApplicationWithOrigins(
  exclude_id: string | null,
  origins: string[]
): Promise<string[]> {
  await dbConnect();

  const application = await ApplicationEntity.findOne({
    allowed_origins: { $in: origins },
    ...(exclude_id ? { _id: { $ne: exclude_id } } : {}),
  }).select("allowed_origins");

  if (!application) {
    return [];
  }

  return application.allowed_origins.filter((origin) =>
    origins.includes(origin)
  );
}

export async function updateApplication(
  user_id: string,
  id: string,
  { name, allowedOrigins, allowedUrls }: UpsertApplication
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
  application.allowed_origins = allowedOrigins;
  application.allowed_urls = allowedUrls;

  await application.save();

  return {
    id: application._id as string,
    name: name,
    allowedOrigins: allowedOrigins,
    allowedUrls: allowedUrls,
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

  // Delete all secrets associated with this application
  await deleteSecretsForApplication(user_id, id);

  await application.deleteOne();
}
