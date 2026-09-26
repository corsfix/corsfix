import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import {
  createApplication,
  deleteApplication,
  getApplications,
  updateApplication,
} from "@/lib/services/applicationService";
import { getApplicationSecrets } from "@/lib/services/secretService";
import { authorize } from "@/lib/services/authorizationService";
import { checkApplicationUpsert } from "@/lib/services/applicationValidation";
import {
  extractDomainFromInput,
  isValidDomain,
  isValidTargetDomain,
} from "@/lib/domains";
import { UpsertApplication, UpsertApplicationSchema } from "@/types/api";
import {
  getAccount,
  handleErrors,
  jsonResult,
  McpAccount,
  McpToolError,
} from "../context";
import { getPlanInfo } from "../plan";

const originDomainsSchema = z
  .array(z.string())
  .min(1)
  .max(8)
  .describe(
    'Domains of the website that calls the proxy, e.g. ["myapp.com", "www.myapp.com"]. Matching is exact, so list every variant. URLs are accepted and reduced to their domain. Localhost does not need registering.'
  );

const targetDomainsSchema = z
  .array(z.string())
  .min(1)
  .max(8)
  .describe(
    'API domains the website may call through the proxy, e.g. ["api.example.com"], or ["*"] for all domains. Listing specific domains is safer when the application uses secrets.'
  );

const createSchema = z.object({
  name: z
    .string()
    .max(64)
    .optional()
    .describe(
      "A label for the application. Defaults to the first origin domain."
    ),
  origin_domains: originDomainsSchema,
  target_domains: targetDomainsSchema.optional(),
});

const updateSchema = z.object({
  application_id: z.string().max(32).describe("The id from list_applications."),
  name: z.string().max(64).optional(),
  origin_domains: originDomainsSchema
    .optional()
    .describe(
      "Replaces the current origin domains. Include the existing ones to keep them."
    ),
  target_domains: targetDomainsSchema
    .optional()
    .describe(
      'Replaces the current target domains. Use ["*"] for all domains.'
    ),
});

const deleteSchema = z.object({
  application_id: z.string().max(32),
  confirm_name: z
    .string()
    .describe("The application's exact name, to confirm the deletion."),
});

const normalizeDomains = (
  values: string[],
  kind: "origin" | "target"
): string[] => {
  const cleaned = [
    ...new Set(
      values
        .map((value) =>
          value.trim() === "*" ? "*" : extractDomainFromInput(value)
        )
        .filter(Boolean)
    ),
  ];
  const invalid = cleaned.filter((domain) =>
    kind === "origin" ? !isValidDomain(domain) : !isValidTargetDomain(domain)
  );
  if (invalid.length > 0) {
    throw new McpToolError(
      `Invalid ${kind} domain${invalid.length > 1 ? "s" : ""}: ${invalid.join(
        ", "
      )}. Use domains like example.com${
        kind === "target" ? ', or "*" for all domains' : ""
      }.`
    );
  }
  if (kind === "target" && cleaned.includes("*") && cleaned.length > 1) {
    return ["*"];
  }
  return cleaned;
};

const toOutput = (app: {
  id: string;
  name: string;
  originDomains?: string[];
  targetDomains?: string[];
}) => ({
  id: app.id,
  name: app.name,
  origin_domains: app.originDomains ?? [],
  target_domains: app.targetDomains ?? [],
  allows_all_targets: (app.targetDomains ?? []).includes("*"),
});

async function findApplication(account: McpAccount, applicationId: string) {
  const applications = await getApplications(account.ownerId);
  const application = applications.find((app) => app.id === applicationId);
  if (!application) {
    throw new McpToolError(
      `No application with id ${applicationId}. Call list_applications to see your applications.`
    );
  }
  return application;
}

const validateBody = async (
  account: McpAccount,
  applicationId: string | null,
  body: UpsertApplication
) => {
  const parsed = UpsertApplicationSchema.safeParse(body);
  if (!parsed.success) {
    throw new McpToolError(
      parsed.error.issues[0]?.message ?? "Invalid application."
    );
  }
  const error = await checkApplicationUpsert(
    account.session,
    applicationId,
    body
  );
  if (error) throw new McpToolError(error);
};

export function registerApplicationTools(server: McpServer) {
  server.registerTool(
    "list_applications",
    {
      title: "List applications",
      description:
        "List your Corsfix applications: the websites (origin domains) allowed to use the proxy in production, the API domains (target domains) each may call, and the names of their secrets. Also shows your plan's application limits.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    handleErrors(
      "list_applications",
      async (_args: Record<string, never>, ctx) => {
        const account = await getAccount(ctx);
        const [applications, plan] = await Promise.all([
          getApplicationSecrets(account.ownerId),
          getPlanInfo(account),
        ]);
        return jsonResult({
          applications: applications.map((app) => ({
            ...toOutput(app),
            secret_names: (app.secrets ?? []).map((secret) => secret.name),
          })),
          plan: plan.name,
          limits: {
            applications: plan.maxApplications,
            origin_domains_per_application: plan.maxOriginsPerApplication,
          },
        });
      }
    )
  );

  server.registerTool(
    "create_application",
    {
      title: "Create application",
      description:
        "Register a website with Corsfix so it can use the proxy in production. origin_domains are the website's domains; target_domains are the API domains it may call (all domains by default). Not needed for local development on localhost.",
      inputSchema: createSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    handleErrors(
      "create_application",
      async (args: z.infer<typeof createSchema>, ctx) => {
        const account = await getAccount(ctx);
        const originDomains = normalizeDomains(args.origin_domains, "origin");
        const targetDomains = normalizeDomains(
          args.target_domains ?? ["*"],
          "target"
        );

        const allowed = await authorize(account.session, "add_applications");
        if (!allowed.allowed) {
          throw new McpToolError(
            allowed.message || "Your plan does not allow more applications."
          );
        }

        const body: UpsertApplication = {
          name: (args.name?.trim() || originDomains[0]).slice(0, 64),
          originDomains,
          targetDomains,
        };
        await validateBody(account, null, body);

        const application = await createApplication(account.ownerId, body);
        return jsonResult({
          created: toOutput({ ...application, id: String(application.id) }),
          next_steps: [
            "Call the proxy from the website (generate_snippet writes the code).",
            targetDomains.includes("*")
              ? "Consider listing specific target domains before adding secrets."
              : "Add API keys with set_secret and reference them as {{SECRET_NAME}}.",
          ],
        });
      }
    )
  );

  server.registerTool(
    "update_application",
    {
      title: "Update application",
      description:
        "Change an application's name, origin domains or target domains. Lists you pass replace the current ones; list_applications shows the current values.",
      inputSchema: updateSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handleErrors(
      "update_application",
      async (args: z.infer<typeof updateSchema>, ctx) => {
        const account = await getAccount(ctx);
        const current = await findApplication(account, args.application_id);

        const body: UpsertApplication = {
          name: args.name?.trim() || current.name,
          originDomains: args.origin_domains
            ? normalizeDomains(args.origin_domains, "origin")
            : current.originDomains ?? [],
          targetDomains: args.target_domains
            ? normalizeDomains(args.target_domains, "target")
            : current.targetDomains ?? ["*"],
        };
        await validateBody(account, current.id, body);

        const application = await updateApplication(
          account.ownerId,
          current.id,
          body
        );
        return jsonResult({
          updated: toOutput({ ...application, id: String(application.id) }),
        });
      }
    )
  );

  server.registerTool(
    "delete_application",
    {
      title: "Delete application",
      description:
        "Delete an application and all of its secrets. Its origin domains stop working with the proxy in production (unless they fall back to the free tier through the SDK). confirm_name must repeat the application's name exactly. This cannot be undone.",
      inputSchema: deleteSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handleErrors(
      "delete_application",
      async (args: z.infer<typeof deleteSchema>, ctx) => {
        const account = await getAccount(ctx);
        const application = await findApplication(account, args.application_id);
        if (args.confirm_name !== application.name) {
          throw new McpToolError(
            `confirm_name does not match. The application is named "${application.name}".`
          );
        }
        await deleteApplication(account.ownerId, application.id);
        return jsonResult({ deleted: toOutput(application) });
      }
    )
  );
}
