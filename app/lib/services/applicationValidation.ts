import { Session } from "next-auth";
import { UpsertApplication } from "@/types/api";
import { freeTierLimit, IS_CLOUD } from "@/config/constants";
import { isLocalDomain } from "@/lib/utils";
import { getPlanTier } from "./authorizationService";
import { hasApplicationWithOrigins } from "./applicationService";

// Checks run before an application is created or updated, shared by the
// dashboard API routes and the MCP server. Returns an error message for the
// user, or null when the change is allowed.
export async function checkApplicationUpsert(
  session: Session | null,
  applicationId: string | null,
  body: UpsertApplication
): Promise<string | null> {
  const localDomains = body.originDomains.filter((domain) =>
    isLocalDomain(domain)
  );
  if (localDomains.length > 0) {
    return "Localhost domains are not allowed as origin domains.";
  }

  if (IS_CLOUD && (await getPlanTier(session)) === "free") {
    if (body.originDomains.length > freeTierLimit.origin_count) {
      return `The free tier allows ${freeTierLimit.origin_count} origin domain per application. Upgrade to add more.`;
    }
  }

  const existingOrigins = await hasApplicationWithOrigins(
    applicationId,
    body.originDomains
  );
  if (existingOrigins.length > 0) {
    return `An application with this origin already exists: ${existingOrigins.join(
      ", "
    )}`;
  }

  return null;
}
