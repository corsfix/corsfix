import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { getApplications } from "@/lib/services/applicationService";
import {
  getApplicationSecrets,
  getSecretsForApplication,
  manageApplicationSecrets,
} from "@/lib/services/secretService";
import { authorize } from "@/lib/services/authorizationService";
import { getKek } from "@/lib/utils";
import {
  getAccount,
  handleErrors,
  jsonResult,
  McpAccount,
  McpToolError,
} from "../context";

const SECRET_NAME = /^[A-Za-z0-9_]+$/;

const listSchema = z.object({
  application_id: z
    .string()
    .max(32)
    .optional()
    .describe(
      "Only list this application's secrets. Leave empty for all applications."
    ),
});

const setSchema = z.object({
  application_id: z.string().max(32).describe("The id from list_applications."),
  name: z
    .string()
    .max(64)
    .describe(
      "Secret name: letters, digits and underscores, e.g. WEATHER_API_KEY."
    ),
  value: z
    .string()
    .min(1)
    .max(255)
    .describe("The secret value, e.g. an API key."),
});

const deleteSchema = z.object({
  application_id: z.string().max(32),
  name: z.string().max(64),
});

async function requireSecretsAccess(account: McpAccount) {
  const allowed = await authorize(account.session, "manage_secrets");
  if (!allowed.allowed) {
    throw new McpToolError(
      allowed.message || "Secrets are not available on your plan."
    );
  }
}

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

async function requireKek(): Promise<string> {
  const kek = await getKek();
  if (!kek) throw new McpToolError("Secrets encryption is not configured.");
  return kek;
}

export function registerSecretTools(server: McpServer) {
  server.registerTool(
    "list_secrets",
    {
      title: "List secrets",
      description:
        "List the secrets stored for your applications. Only names and masked values are returned; secret values can never be read back.",
      inputSchema: listSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    handleErrors(
      "list_secrets",
      async (args: z.infer<typeof listSchema>, ctx) => {
        const account = await getAccount(ctx);
        const applications = await getApplicationSecrets(account.ownerId);
        const selected = args.application_id
          ? applications.filter((app) => app.id === args.application_id)
          : applications;
        if (args.application_id && selected.length === 0) {
          throw new McpToolError(
            `No application with id ${args.application_id}.`
          );
        }
        const available = await authorize(account.session, "manage_secrets");
        return jsonResult({
          secrets_available_on_plan: available.allowed,
          ...(available.allowed ? {} : { note: available.message }),
          applications: selected.map((app) => ({
            application_id: app.id,
            application_name: app.name,
            secrets: (app.secrets ?? []).map((secret) => ({
              name: secret.name,
              masked_value: secret.masked_value,
              usage: `{{${secret.name}}}`,
            })),
          })),
        });
      }
    )
  );

  server.registerTool(
    "set_secret",
    {
      title: "Set secret",
      description:
        "Create a secret on an application, or replace the value of an existing secret with the same name. Requests from the application's origin domains can then reference it as {{NAME}} in the target URL's query string or in request headers, and the proxy substitutes the value, so API keys never ship in frontend code. Needs a Standard paid plan or an active trial.",
      inputSchema: setSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handleErrors("set_secret", async (args: z.infer<typeof setSchema>, ctx) => {
      const account = await getAccount(ctx);
      if (!SECRET_NAME.test(args.name)) {
        throw new McpToolError(
          "Secret names may only contain letters, digits and underscores."
        );
      }
      await requireSecretsAccess(account);
      const application = await findApplication(account, args.application_id);
      const existing = (
        await getSecretsForApplication(account.ownerId, application.id)
      ).find((secret) => secret.name === args.name);

      await manageApplicationSecrets(
        account.ownerId,
        await requireKek(),
        application.id,
        [{ id: existing?.id, name: args.name, value: args.value }]
      );

      const allTargets = (application.targetDomains ?? []).includes("*");
      return jsonResult({
        action: existing ? "updated" : "created",
        application_id: application.id,
        name: args.name,
        use_as: `{{${args.name}}}`,
        ...(allTargets
          ? {
              warning:
                "This application may call all target domains, so any page on its origins could send the secret anywhere. Restrict target_domains with update_application.",
            }
          : {}),
      });
    })
  );

  server.registerTool(
    "delete_secret",
    {
      title: "Delete secret",
      description:
        "Delete a secret from an application. Requests that still reference {{NAME}} will send the literal text instead. This cannot be undone.",
      inputSchema: deleteSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handleErrors(
      "delete_secret",
      async (args: z.infer<typeof deleteSchema>, ctx) => {
        const account = await getAccount(ctx);
        await requireSecretsAccess(account);
        const application = await findApplication(account, args.application_id);
        const existing = (
          await getSecretsForApplication(account.ownerId, application.id)
        ).find((secret) => secret.name === args.name);
        if (!existing) {
          throw new McpToolError(
            `${application.name} has no secret named ${args.name}.`
          );
        }
        await manageApplicationSecrets(
          account.ownerId,
          await requireKek(),
          application.id,
          [{ id: existing.id, name: existing.name, value: null, delete: true }]
        );
        return jsonResult({
          deleted: args.name,
          application_id: application.id,
        });
      }
    )
  );
}
