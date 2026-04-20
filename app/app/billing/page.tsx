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
import { config, IS_CLOUD, trialLimit } from "@/config/constants";
import {
  formatBytes,
  getTrialEnds,
  getUserId,
  isTrialActive,
} from "@/lib/utils";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getMonthToDateMetrics } from "@/lib/services/metricService";
import { FounderBenefitModal } from "@/components/founder-benefit-modal";
import { PlansSection } from "./plans-section";
import type { Subscription } from "@/types/api";

const trialBenefits = [
  `Up to ${trialLimit.app_count} web applications`,
  `${formatBytes(trialLimit.bytes)} data transfer`,
  `${trialLimit.rpm} RPM (per IP)`,
  "Cached response",
  `Secrets variable`,
];


export const metadata: Metadata = {
  title: "Billing | Corsfix Dashboard",
};

export default async function CreditsPage() {
  const session = await auth();

  let subscription: Subscription;
  let isTrial: boolean;
  let bandwidthMtd: number;

  try {
    isTrial = isTrialActive(session);

    if (!session?.user.id) {
      throw Error("Unauthenticated.");
    }
    subscription = await getActiveSubscription(session.user.id);

    if (subscription.active) {
      isTrial = false;
    } else if (isTrial) {
      const trialEnds = getTrialEnds(session);
      const formattedDate = trialEnds.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      subscription.name = `trial (until ${formattedDate})`;
      subscription.label = `Trial (until ${formattedDate})`;
      subscription.bandwidth = trialLimit.bytes;
    }

    const idToken = getUserId(session);
    const metricsMtd = await getMonthToDateMetrics(idToken);
    bandwidthMtd = metricsMtd.bytes;
  } catch (error: unknown) {
    console.error(JSON.stringify(error, null, 2));
    isTrial = false;
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
                {isTrial && IS_CLOUD && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <ul className="space-y-2">
                          {trialBenefits.map((benefit, index) => (
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
                  {isTrial || subscription.active ? (
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
                        : `${Math.min(
                            Math.ceil(
                              (bandwidthMtd /
                                (subscription.bandwidth +
                                  (subscription.extraBandwidth ?? 0))) *
                                100
                            ),
                            100
                          )}%`,
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
          />
        )}
      </div>
    </>
  );
}
