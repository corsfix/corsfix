import {
  Activity,
  BarChart3,
  Check,
  CreditCard,
  Info,
  Infinity,
  PackageIcon,
  SquareArrowOutUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Nav from "@/components/nav";
import Link from "next/link";
import { getActiveSubscription } from "@/lib/services/subscriptionService";
import { config, IS_CLOUD, trialLimit } from "@/config/constants";
import {
  cn,
  formatBytes,
  getTrialEnds,
  getUserId,
  isTrialActive,
} from "@/lib/utils";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getMonthToDateMetrics } from "@/lib/services/metricService";

function getCustomerCheckoutLink(
  baseLink: string | null | undefined,
  email: string | null | undefined
): string {
  if (!baseLink || !email) {
    return baseLink || "/";
  }

  const url = new URL(baseLink);
  url.searchParams.set("customer_email", email);
  return url.toString();
}

const trialBenefits = [
  `Up to ${trialLimit.app_count} web applications`,
  `${formatBytes(trialLimit.bytes)} data transfer`,
  `${trialLimit.rpm} RPM (per IP)`,
  "Cached response",
  `Secrets variable`,
];

const paidBenefits = [
  "Unlimited proxy requests",
  "Unlimited web applications",
  "{{bandwidth}} data transfer",
  "{{rpm}} RPM (per IP)",
  "Cached response",
  "Secrets variable",
  "Global infrastructure",
  "Priority support",
];

export const metadata: Metadata = {
  title: "Billing | Corsfix Dashboard",
};

export default async function CreditsPage() {
  const session = await auth();

  let subscription, isTrial, bandwidthMtd;

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

  return (
    <>
      <Nav />
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-2 inline-flex items-center">
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
                {IS_CLOUD
                  ? subscription.name.charAt(0).toUpperCase() +
                    subscription.name.slice(1)
                  : "-"}
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
                      Upgrade to use Corsfix on live web applications
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
                              (bandwidthMtd / subscription.bandwidth) * 100
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
                  ) : (
                    <>
                      <div className="text-sm">
                        {new Date().toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </div>
                      <span>
                        {formatBytes(bandwidthMtd)}&nbsp;/&nbsp;
                        {formatBytes(subscription.bandwidth)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {IS_CLOUD && (
          <div className="mt-2">
            <h2 className="text-2xl font-semibold mb-2">Plans</h2>
            <div className="flex flex-row gap-3 overflow-x-auto">
              <div
                className="flex-1 border-2 rounded-xl px-1.5 pb-1.5 flex flex-col"
                style={{ borderColor: "#595BE7" }}
              >
                <h3 className="text-sm font-bold text-[#595BE7] text-center py-0.5">
                  Standard
                </h3>
                <div className="flex flex-row space-x-3 flex-1">
                  {config.products
                    .filter((p) => p.type === "standard")
                    .map((product) => {
                      const isCurrentPlan = subscription.name === product.name;
                      return (
                        <div
                          key={product.id}
                          className="w-1/3 min-w-[350px] mb-8 lg:mb-0 snap-center flex h-full"
                        >
                          <Card
                            className={cn(
                              "w-full flex flex-col h-full",
                              isCurrentPlan && "border-primary"
                            )}
                          >
                            <CardHeader className="flex-none">
                              <div className="flex justify-between items-center">
                                <CardTitle className="text-xl">
                                  {product.name.charAt(0).toUpperCase() +
                                    product.name.slice(1)}
                                </CardTitle>
                                {isCurrentPlan && (
                                  <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="flex items-end gap-2 mt-4">
                                <span className="text-3xl font-bold">
                                  ${product.price}
                                </span>
                                <span className="text-muted-foreground pb-1">
                                  / month
                                </span>
                              </div>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col">
                              <ul className="space-y-4 flex-1">
                                {paidBenefits.map((benefit, index) => (
                                  <li
                                    key={index}
                                    className="flex items-center gap-2"
                                  >
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    <span>
                                      {benefit
                                        .replace(
                                          "{{rpm}}",
                                          product.rpm.toString()
                                        )
                                        .replace(
                                          "{{bandwidth}}",
                                          formatBytes(product.bandwidth)
                                        )}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                              {!subscription.active && (
                                <div className="mt-6 flex-none">
                                  <Link
                                    href={getCustomerCheckoutLink(
                                      product.link,
                                      session?.user?.email
                                    )}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Button
                                      className="w-full"
                                      data-umami-event={`pricing-${product.name.toLowerCase()}`}
                                    >
                                      Upgrade
                                    </Button>
                                  </Link>
                                </div>
                              )}
                              {subscription.active &&
                                subscription.name == product.name && (
                                  <div className="mt-6 flex-none">
                                    <Link href="/api/portal" target="_blank">
                                      <Button
                                        data-umami-event="billing-manage"
                                        className="w-full flex items-center gap-2"
                                      >
                                        Manage <SquareArrowOutUpRight />
                                      </Button>
                                    </Link>
                                  </div>
                                )}
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })}
                </div>
              </div>
              <div
                className="flex-1 border-2 rounded-xl px-1.5 pb-1.5 flex flex-col"
                style={{ borderColor: "#59A2E7" }}
              >
                <h3 className="text-sm font-bold text-[#59A2E7] text-center py-0.5">
                  Lite
                </h3>
                <Card
                  className={cn(
                    "w-full min-w-[350px] flex flex-col flex-1",
                    subscription.isLite && "border-primary"
                  )}
                >
                  <CardHeader className="flex-none">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-xl">Lite</CardTitle>
                      {subscription.isLite && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-end gap-2 mt-4">
                      <span className="text-3xl font-bold">$5</span>
                      <span className="text-muted-foreground pb-1">
                        / month
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-4 flex-1">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="flex items-center gap-1">
                          Unlimited proxy requests
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">
                                  Proxy URL: lite.corsfix.com
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        <span>Unlimited web applications</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="flex items-center gap-1">
                          Unlimited data transfer
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">
                                  Text only, max 1 MB per request
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="flex items-center gap-1">
                          600 RPM (shared)
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">
                                  The RPM pool is shared for all visitors of
                                  your websites, different from Standard plans
                                  where the RPM is per individual IP address
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        <span>Secrets variable</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        <span>EU region infrastructure</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        <span>Priority support</span>
                      </li>
                    </ul>
                    {!subscription.active && (
                      <div className="mt-6 flex-none">
                        <Link
                          href={getCustomerCheckoutLink(
                            "https://buy.polar.sh/polar_cl_YutObDmIpdlxLAyBu3fC2nrf3JrsTpMocTwVi3A3LBw",
                            session?.user?.email
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button
                            className="w-full"
                            data-umami-event={`pricing-lite`}
                          >
                            Upgrade
                          </Button>
                        </Link>
                      </div>
                    )}
                    {subscription.active && subscription.name == "lite" && (
                      <div className="mt-6 flex-none">
                        <Link href="/api/portal" target="_blank">
                          <Button
                            data-umami-event="billing-manage"
                            className="w-full flex items-center gap-2"
                          >
                            Manage <SquareArrowOutUpRight />
                          </Button>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
