import {
  ActivityIcon,
  Check,
  PackageIcon,
  SettingsIcon,
  SquareArrowOutUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/nav";
import Link from "next/link";
import { getActiveSubscription } from "@/lib/services/subscriptionService";
import { config, IS_CLOUD } from "@/config/constants";
import { cn, getUserId } from "@/lib/utils";
import type { Metadata } from "next";
import { auth } from "@/auth";

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

const freeBenefits = [
  "Unlimited monthly requests",
  "60 requests per minute",
  "Limited to local apps",
  "Best effort support",
];

const paidBenefits = [
  "Unlimited monthly requests",
  "{{rpm}} requests per minute",
  "Unlimited applications",
  "Priority support",
  "Cached response",
  "Secrets variable",
];

export const metadata: Metadata = {
  title: "Billing | Corsfix Dashboard",
};

export default async function CreditsPage() {
  const session = await auth();

  let idToken, activeSubscription;

  try {
    idToken = getUserId(session);
    activeSubscription = await getActiveSubscription(idToken);
  } catch (error: unknown) {
    console.error(JSON.stringify(error, null, 2));
    idToken = null;
    activeSubscription = { active: false, name: "Free" };
  }

  const isOnFreePlan = !activeSubscription.active;

  return (
    <>
      <Nav />
      <div className="p-4">
        <h1 className="text-3xl font-bold mb-6">Billing</h1>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Subscription Status
              </CardTitle>
              <ActivityIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {IS_CLOUD && activeSubscription.active ? "Active" : "Inactive"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Current Plan
              </CardTitle>
              <PackageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {IS_CLOUD
                  ? activeSubscription.name.charAt(0).toUpperCase() +
                    activeSubscription.name.slice(1)
                  : "-"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Subscription & Billing
              </CardTitle>
              <SettingsIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {IS_CLOUD && activeSubscription.active ? (
                <Link
                  href="/api/portal"
                  target="_blank"
                  className="text-primary hover:underline"
                >
                  <Button
                    data-umami-event="billing-manage"
                    className="flex items-center gap-2"
                  >
                    Manage <SquareArrowOutUpRight />
                  </Button>
                </Link>
              ) : (
                <Button
                  data-umami-event="billing-manage"
                  className="flex items-center gap-2"
                  disabled={true}
                >
                  Manage <SquareArrowOutUpRight />
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Available Plans */}
        {IS_CLOUD && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Available Plans</h2>
            <div className="flex flex-row -mx-4 items-stretch overflow-x-auto snap-x snap-mandatory">
              <div
                key={"free"}
                className="w-1/4 min-w-[350px] px-4 mb-8 lg:mb-0 snap-center flex"
              >
                <Card
                  className={cn(
                    "w-full flex flex-col",
                    isOnFreePlan && "border-primary"
                  )}
                >
                  <CardHeader className="flex-none">
                    <div className="flex justify-between items-center">
                      <CardTitle>Free</CardTitle>
                      {isOnFreePlan && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                          Current Plan
                        </span>
                      )}
                    </div>
                    <div className="flex items-end gap-2 mt-4">
                      <span className="text-4xl font-bold">$0</span>
                      <span className="text-muted-foreground pb-1">
                        per month
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-4 flex-1">
                      {freeBenefits.map((benefit, index) => (
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
                const isCurrentPlan = activeSubscription.name === product.name;
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
                          <CardTitle>
                            {product.name.charAt(0).toUpperCase() +
                              product.name.slice(1)}
                          </CardTitle>
                          {isCurrentPlan && (
                            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                              Current Plan
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
                                {benefit.replace(
                                  "{{rpm}}",
                                  product.rpm.toString()
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {isOnFreePlan && (
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
                                Select Plan
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
