import {
  Activity,
  BarChart3,
  Check,
  CreditCard,
  Info,
  Infinity,
  PackageIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Nav from "@/components/nav";
import { getActiveSubscription } from "@/lib/services/subscriptionService";
import { config, freeTierLimit, IS_CLOUD, trialLimit } from "@/config/constants";
import {
  formatBytes,
  formatTrialEnds,
  getUserId,
  isTrialActive,
} from "@/lib/utils";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getMonthToDateMetrics } from "@/lib/services/metricService";
import { getFreeTierUsage } from "@/lib/services/freeTierService";
import { isTrialUsed } from "@/lib/services/trialService";
import { FounderBenefitModal } from "@/components/founder-benefit-modal";
import { PlansSection } from "./plans-section";
import type {
  FreeTierDomainUsage,
  Subscription,
  TrialState,
} from "@/types/api";

const trialBenefits = [
  `Up to ${trialLimit.app_count} web applications`,
  `${formatBytes(trialLimit.bytes)} data transfer`,
  `${trialLimit.rpm} RPM (per user)`,
  "Cached response",
  "Secrets variables",
  "All file sizes & types",
];

const freeTierBenefits = [
  `${freeTierLimit.app_count} web application (${freeTierLimit.origin_count} origin domain)`,
  `${formatBytes(freeTierLimit.registeredBytes)} data transfer per domain`,
  `${freeTierLimit.concurrency} concurrent user`,
  `${freeTierLimit.rpm} RPM (per user)`,
  "All file sizes & types",
  "Requires the Corsfix SDK (CDN or NPM)",
];

export const metadata: Metadata = {
  title: "Billing | Corsfix Dashboard",
};

export default async function CreditsPage() {
  const session = await auth();

  let subscription: Subscription;
  let isTrial: boolean;
  let isFree = false;
  let bandwidthMtd: number;
  let freeTierUsage: FreeTierDomainUsage[] = [];
  let trialState: TrialState = "used";

  try {
    if (!session?.user.id) {
      throw Error("Unauthenticated.");
    }
    subscription = await getActiveSubscription(session.user.id);

    // Precedence: paid plan, then trial, then free.
    isTrial = !subscription.active && isTrialActive(subscription.trial_ends_at);
    trialState = isTrial
      ? "active"
      : isTrialUsed(subscription.trial_ends_at)
      ? "used"
      : "available";

    const idToken = getUserId(session);

    if (subscription.active) {
      // nothing to adjust
    } else if (isTrial) {
      const formattedDate = formatTrialEnds(subscription.trial_ends_at);
      subscription.name = `trial (until ${formattedDate})`;
      subscription.label = `Trial (until ${formattedDate})`;
      subscription.bandwidth = trialLimit.bytes;
    } else if (IS_CLOUD) {
      // No plan and no trial: the account is on the always-free tier.
      isFree = true;
      subscription.name = "free";
      subscription.label = "Free";
      subscription.bandwidth = freeTierLimit.registeredBytes;
      freeTierUsage = await getFreeTierUsage(idToken);
    }

    const metricsMtd = await getMonthToDateMetrics(idToken);
    bandwidthMtd = metricsMtd.bytes;
  } catch (error: unknown) {
    console.error(JSON.stringify(error, null, 2));
    isTrial = false;
    isFree = false;
    trialState = "used";
    subscription = {
      active: false,
      name: "-",
      bandwidth: 0,
    };
    bandwidthMtd = 0;
  }

  const currentPlanDisplay =
    subscription.label ??
    subscription.name.charAt(0).toUpperCase() + subscription.name.slice(1);

  const defaultBillingCycle =
    subscription.billingCycle === "yearly" ? "yearly" : "monthly";

  const planBenefits = isTrial
    ? trialBenefits
    : isFree
    ? freeTierBenefits
    : null;

  // Free tier allowance is per domain, so the bar tracks the busiest one.
  const freeTierMaxBytes = freeTierUsage.reduce(
    (max, usage) => Math.max(max, usage.bytes),
    0
  );

  const usagePercent = (used: number, limit: number) =>
    `${Math.min(Math.ceil((used / limit) * 100), 100)}%`;

  return (
    <>
      <Nav />
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4 inline-flex items-center">
          <CreditCard size={28} className="mr-2" />
          Billing
        </h1>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Current Plan
              </CardTitle>
              <PackageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mt-3 text-primary flex items-center gap-2">
                {IS_CLOUD ? currentPlanDisplay : "-"}
                {(subscription.extraBandwidth ||
                  subscription.regionSelection ||
                  subscription.noMinCacheTtl ||
                  subscription.noConcurrencyLimit) && (
                  <FounderBenefitModal
                    extraBandwidth={
                      subscription.extraBandwidth
                        ? formatBytes(subscription.extraBandwidth)
                        : undefined
                    }
                    regionSelection={subscription.regionSelection}
                    noMinCacheTtl={subscription.noMinCacheTtl}
                    noConcurrencyLimit={subscription.noConcurrencyLimit}
                  />
                )}
                {planBenefits && IS_CLOUD && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <ul className="space-y-2">
                          {planBenefits.map((benefit, index) => (
                            <li key={index} className="flex items-center gap-2">
                              <Check className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="text-sm">{benefit}</span>
                            </li>
                          ))}
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Requests</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="mt-3 space-y-1">
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full transition-all duration-300 w-full"></div>
                </div>
                <div className="flex items-center justify-between">
                  {isTrial || isFree || subscription.active ? (
                    <>
                      <div className="text-sm">You have unlimited requests</div>
                      <Infinity />
                    </>
                  ) : (
                    <div className="text-sm">
                      Upgrade to use Corsfix on production
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Data Transfer
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="mt-3 space-y-1">
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{
                      width: subscription.isLite
                        ? "100%"
                        : isFree
                        ? usagePercent(
                            freeTierMaxBytes,
                            freeTierLimit.registeredBytes
                          )
                        : usagePercent(
                            bandwidthMtd,
                            subscription.bandwidth +
                              (subscription.extraBandwidth ?? 0)
                          ),
                    }}
                  ></div>
                </div>
                <div className="flex items-center justify-between">
                  {subscription.isLite ? (
                    <>
                      <div className="text-sm">
                        You have unlimited data transfer
                      </div>
                      <Infinity />
                    </>
                  ) : isTrial || subscription.active ? (
                    <>
                      <div className="text-sm">
                        {new Date().toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </div>
                      <span>
                        {formatBytes(bandwidthMtd)}&nbsp;/&nbsp;
                        {formatBytes(
                          subscription.bandwidth +
                            (subscription.extraBandwidth ?? 0)
                        )}
                      </span>
                    </>
                  ) : isFree ? (
                    <div className="text-sm w-full">
                      {freeTierUsage.length === 0 ? (
                        <span>
                          Register your domain for{" "}
                          {formatBytes(freeTierLimit.registeredBytes)} per
                          month
                        </span>
                      ) : (
                        <ul className="space-y-1">
                          {freeTierUsage.map((usage) => (
                            <li
                              key={usage.domain}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="truncate">{usage.domain}</span>
                              <span className="whitespace-nowrap">
                                {formatBytes(usage.bytes)}&nbsp;/&nbsp;
                                {formatBytes(freeTierLimit.registeredBytes)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm">
                      Upgrade to use Corsfix on production
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {IS_CLOUD && (
          <PlansSection
            products={config.products}
            subscription={subscription}
            sessionEmail={session?.user?.email}
            defaultBillingCycle={defaultBillingCycle}
            trialState={trialState}
            trialEndsAt={
              isTrial && subscription.trial_ends_at
                ? new Date(subscription.trial_ends_at).toISOString()
                : null
            }
            trialBenefits={trialBenefits}
            trialDays={trialLimit.days}
          />
        )}
      </div>
    </>
  );
}
