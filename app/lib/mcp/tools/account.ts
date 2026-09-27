import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { IS_CLOUD } from "@/config/constants";
import {
  aggregateByDate,
  getConcurrencyYearMonth,
  getMetricsYearMonth,
  getMonthToDateMetrics,
} from "@/lib/services/metricService";
import { getFreeTierUsage } from "@/lib/services/freeTierService";
import { formatBytes } from "@/lib/utils";
import { extractDomainFromInput } from "@/lib/domains";
import { getAccount, handleErrors, jsonResult, McpToolError } from "../context";
import { getPlanInfo, getProxyBaseUrl } from "../plan";

const usageSchema = z.object({
  month: z
    .string()
    .optional()
    .describe("Month as YYYY-MM (UTC). Defaults to the current month."),
  origin_domains: z
    .array(z.string())
    .max(20)
    .optional()
    .describe("Only count traffic from these origin domains."),
});

const currentMonth = () => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}`;
};

export function registerAccountTools(server: McpServer) {
  server.registerTool(
    "get_account",
    {
      title: "Account and plan",
      description:
        "Show the Corsfix plan, what it includes (applications, origin domains, secrets, region selection), this month's usage, and the proxy URL this account should use.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    handleErrors("get_account", async (_args: Record<string, never>, ctx) => {
      const account = await getAccount(ctx);
      const plan = await getPlanInfo(account);
      const usage = await getMonthToDateMetrics(account.ownerId);
      const freeTier =
        plan.tier === "free" ? await getFreeTierUsage(account.ownerId) : [];

      return jsonResult({
        email: account.email,
        plan: {
          name: plan.name,
          tier: plan.tier,
          ...(plan.trialEndsAt ? { trial_ends_at: plan.trialEndsAt } : {}),
          includes: {
            applications: plan.maxApplications,
            origin_domains_per_application: plan.maxOriginsPerApplication,
            secrets: plan.secretsAvailable,
            region_selection: plan.regionSelection,
            ...(plan.bandwidthBytes
              ? { monthly_data_transfer: formatBytes(plan.bandwidthBytes) }
              : {}),
            ...(plan.cacheMinimum
              ? { minimum_cache_duration: plan.cacheMinimum }
              : {}),
          },
          ...(plan.tier === "free"
            ? {
                note: "Live websites on the free tier must use the Corsfix SDK. Upgrade or start the 7-day trial from the billing page.",
              }
            : {}),
        },
        proxy_url: getProxyBaseUrl(plan),
        usage_this_month: {
          requests: usage.req_count,
          data_transfer: formatBytes(usage.bytes),
        },
        ...(freeTier.length
          ? {
              free_tier_data_transfer_by_domain: freeTier.map((entry) => ({
                domain: entry.domain,
                used: formatBytes(entry.bytes),
              })),
            }
          : {}),
        dashboard: {
          applications: `${account.issuer}/applications`,
          ...(IS_CLOUD ? { billing: `${account.issuer}/billing` } : {}),
        },
      });
    })
  );

  server.registerTool(
    "get_usage",
    {
      title: "Usage metrics",
      description:
        "Get proxy usage for a month: requests, data transfer and peak concurrent users per day (days without traffic are skipped), with monthly totals. Requests and data transfer can be filtered by origin domain; concurrent users are only tracked for the whole account.",
      inputSchema: usageSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    handleErrors(
      "get_usage",
      async (args: z.infer<typeof usageSchema>, ctx) => {
        const account = await getAccount(ctx);
        const month = args.month ?? currentMonth();
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
          throw new McpToolError("month must look like 2026-09.");
        }
        const domains = args.origin_domains?.map(extractDomainFromInput);
        const filtered = !!domains?.length;

        const [points, concurrency] = await Promise.all([
          getMetricsYearMonth(account.ownerId, month),
          getConcurrencyYearMonth(account.ownerId, month),
        ]);
        // Concurrent users are only tracked for the whole account, so they are
        // left out of the per-day figures when filtering by origin domain.
        const days = aggregateByDate(
          points,
          month,
          domains,
          filtered ? undefined : concurrency
        );
        const active = days.filter(
          (day) => day.req_count > 0 || (day.peak_concurrent ?? 0) > 0
        );
        const totalRequests = days.reduce((sum, day) => sum + day.req_count, 0);
        const totalBytes = days.reduce((sum, day) => sum + day.bytes, 0);
        const accountPeak = Math.max(
          0,
          ...concurrency.map((day) => day.peak_concurrent)
        );

        return jsonResult({
          month,
          ...(filtered ? { origin_domains: domains } : {}),
          totals: {
            requests: totalRequests,
            data_transfer: formatBytes(totalBytes),
            data_transfer_bytes: totalBytes,
            ...(filtered ? {} : { peak_concurrent_users: accountPeak }),
          },
          days: active.map((day) => ({
            date: new Date(day.date).toISOString().slice(0, 10),
            requests: day.req_count,
            data_transfer_bytes: day.bytes,
            ...(filtered
              ? {}
              : { peak_concurrent_users: day.peak_concurrent ?? 0 }),
          })),
          ...(filtered
            ? {
                account_peak_concurrent_users: accountPeak,
                note: "Concurrent users are counted for the whole account, not per origin domain, so only the account-wide peak is shown.",
              }
            : {}),
          origin_domains_with_traffic: [
            ...new Set(
              points.map((point) => point.origin_domain).filter(Boolean)
            ),
          ].sort(),
        });
      }
    )
  );
}
