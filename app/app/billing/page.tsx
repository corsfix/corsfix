import {
  Activity,
  BarChart3,
  Check,
  CreditCard,
  Infinity,
  PackageIcon,
  SquareArrowOutUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  `Unlimited proxy requests`,
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
        <h1 className="text-2xl font-bold mb-4 inline-flex items-center">
          <CreditCard size={28} className="mr-2" />
          Billing
        </h1>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Current Plan
              </CardTitle>
              <PackageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mt-3 text-primary">
                {IS_CLOUD
                  ? subscription.name.charAt(0).toUpperCase() +
                    subscription.name.slice(1)
                  : "-"}
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
                      width: `${Math.min(
                        Math.ceil(
                          (bandwidthMtd / subscription.bandwidth) * 100
                        ),
                        100
                      )}%`,
                    }}
                  ></div>
                </div>
                <div className="flex items-center justify-between">
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
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {IS_CLOUD && (
          <div className="mt-6">
            <h2 className="text-2xl font-bold mb-6">Plans</h2>
            <div className="flex flex-row -mx-4 items-stretch overflow-x-auto snap-x snap-mandatory">
              <div
                key={"trial"}
                className="w-1/4 min-w-[350px] px-4 mb-8 lg:mb-0 snap-center flex"
              >
                <Card
                  className={cn(
                    "w-full flex flex-col",
                    isTrial && "border-primary"
                  )}
                >
                  <CardHeader className="flex-none">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-xl">Trial</CardTitle>
                      {isTrial && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-end gap-2 mt-4">
                      <span className="text-4xl font-bold">$0</span>
                      <span className="text-muted-foreground pb-1">
                        during trial
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-4 flex-1">
                      {trialBenefits.map((benefit, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
              {config.products.map((product) => {
                const isCurrentPlan = subscription.name === product.name;
                return (
                  <div
                    key={product.id}
                    className="w-1/4 min-w-[350px] px-4 mb-8 lg:mb-0 snap-center flex"
                  >
                    <Card
                      className={cn(
                        "w-full flex flex-col",
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
                          <span className="text-4xl font-bold">
                            ${product.price}
                          </span>
                          <span className="text-muted-foreground pb-1">
                            per month
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col">
                        <ul className="space-y-4 flex-1">
                          {paidBenefits.map((benefit, index) => (
                            <li key={index} className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-primary flex-shrink-0" />
                              <span>
                                {benefit
                                  .replace("{{rpm}}", product.rpm.toString())
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
                        {IS_CLOUD &&
                          subscription.active &&
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
        )}
      </div>
    </>
  );
}
