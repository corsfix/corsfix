import { ApplicationEntity } from "@/models/ApplicationEntity";
import { FreeTierMonthlyEntity } from "@/models/FreeTierMonthlyEntity";
import { FreeTierDomainUsage } from "@/types/api";
import dbConnect from "../dbConnect";

export const getFreeTierMonthKey = (date: Date = new Date()): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

// Month to date free tier usage for every origin domain the user has
// registered. Usage is keyed by domain, so this includes traffic from before
// the domain was registered.
export async function getFreeTierUsage(
  user_id: string
): Promise<FreeTierDomainUsage[]> {
  await dbConnect();

  const applications = await ApplicationEntity.find({ user_id })
    .select("origin_domains")
    .lean();

  const domains = [
    ...new Set(applications.flatMap((app) => app.origin_domains ?? [])),
  ];
  if (domains.length === 0) {
    return [];
  }

  const month = getFreeTierMonthKey();
  const docs = await FreeTierMonthlyEntity.find({
    _id: { $in: domains.map((domain) => `${domain}:${month}`) },
  }).lean();

  const bytesByDomain = new Map(docs.map((doc) => [doc.domain, doc.bytes]));

  return domains.map((domain) => ({
    domain,
    bytes: bytesByDomain.get(domain) ?? 0,
  }));
}
