"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CircleCheck, SquareArrowOutUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { BillingCycle, Product } from "@/config/constants";
import type { Subscription, TrialState } from "@/types/api";
import { apiClient } from "@/lib/api-client";

const TRIAL_COLOR = "#3FB27F";

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

interface PlansSectionProps {
  products: Product[];
  subscription: Subscription;
  sessionEmail?: string | null;
  defaultBillingCycle: BillingCycle;
  trialState: TrialState;
  /** ISO date, only when the trial is active. */
  trialEndsAt: string | null;
  trialBenefits: string[];
  trialDays: number;
}

export function PlansSection({
  products,
  subscription,
  sessionEmail,
  defaultBillingCycle,
  trialState,
  trialEndsAt,
  trialBenefits,
  trialDays,
}: PlansSectionProps) {
  const [billingCycle, setBillingCycle] =
    useState<BillingCycle>(defaultBillingCycle);
  const [activatingTrial, setActivatingTrial] = useState(false);
  const [trialSuccessOpen, setTrialSuccessOpen] = useState(false);
  const router = useRouter();

  const activateTrial = async () => {
    setActivatingTrial(true);
    try {
      const result = await apiClient.post<{ trial_ends_at: string }>(
        "/trial",
        {}
      );
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      // Pages read trial status from the database, so a refresh is enough.
      // Client state survives the refresh, so the dialog stays open.
      setTrialSuccessOpen(true);
      router.refresh();
    } catch (error) {
      console.error("Failed to activate trial", error);
      toast.error("Failed to activate trial");
    } finally {
      setActivatingTrial(false);
    }
  };

  const trialEndsLabel = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  const standardPlans = products.filter(
    (p) => p.type === "standard" && p.billingCycle === billingCycle
  );
  const litePlan = products.find((p) => p.type === "lite");

  return (
    <div className="mt-6">
      <Dialog open={trialSuccessOpen} onOpenChange={setTrialSuccessOpen}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader className="items-center">
            <CircleCheck
              className="h-12 w-12 mb-2"
              style={{ color: TRIAL_COLOR }}
            />
            <DialogTitle>Trial activated</DialogTitle>
            <DialogDescription>
              Enjoy {trialDays} days of every Corsfix feature, on us.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button
              onClick={() => setTrialSuccessOpen(false)}
              data-umami-event="trial-activated-dismiss"
            >
              Let&apos;s go
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Plans</h2>
          <p className="text-sm text-muted-foreground mt-1">
            All Corsfix plans include unlimited requests.
          </p>
        </div>
        <div className="relative flex flex-row items-center gap-2 md:block">
          <Tabs
            value={billingCycle}
            onValueChange={(value) => setBillingCycle(value as BillingCycle)}
          >
            <TabsList>
              <TabsTrigger value="monthly" className="px-4">
                Monthly
              </TabsTrigger>
              <TabsTrigger value="yearly" className="px-4">
                Yearly
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <span
            className={`text-xs font-semibold text-green-500 md:absolute md:top-full md:right-0 md:mt-1 ${
              billingCycle === "yearly" ? "visible" : "invisible"
            }`}
            aria-hidden={billingCycle !== "yearly"}
          >
            2 months free
          </span>
        </div>
      </div>

      <div
        className="border-2 rounded-2xl p-2 relative"
        style={{ borderColor: "#595BE7" }}
      >
        <h3 className="text-sm font-bold bg-background px-2 text-[#595BE7] absolute left-1/2 -translate-x-1/2 -top-3">
          Standard
        </h3>
        <div className="overflow-x-auto snap-x snap-mandatory">
          <div className="flex flex-row gap-3 min-w-full w-fit">
            {standardPlans.map((product) => {
              const isCurrentPlan = subscription.product_id === product.id;
              const period =
                product.billingCycle === "yearly" ? "/ year" : "/ month";
              return (
                <div
                  className="w-full md:w-1/3 min-w-80 flex"
                  key={product.id}
                >
                  <Card className="w-full flex flex-col h-full snap-center">
                    <CardHeader className="flex-none pb-3">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-xl">
                          {product.label}
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
                          {period}
                        </span>
                      </div>
                      {product.description && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {product.description}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      {!subscription.active ? (
                        <div className="mb-6 flex-none">
                          <Link
                            href={getCustomerCheckoutLink(
                              product.link,
                              sessionEmail
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button
                              className="w-full"
                              data-umami-event={`pricing-${product.name}`}
                            >
                              Upgrade
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <div className="mb-6 flex-none">
                          <Link href="/api/portal" target="_blank">
                            <Button
                              data-umami-event="billing-manage"
                              className="w-full flex items-center gap-2"
                              variant={isCurrentPlan ? "default" : "outline"}
                            >
                              {isCurrentPlan ? (
                                <>
                                  Manage <SquareArrowOutUpRight />
                                </>
                              ) : (
                                "Change Plan"
                              )}
                            </Button>
                          </Link>
                        </div>
                      )}
                      <ul className="space-y-4 flex-1">
                        {(product.benefits ?? []).map((benefit, index) => (
                          <li
                            key={index}
                            className="flex items-center gap-2"
                          >
                            <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Secondary offers: compact strips so the Standard plans stay the
          primary call to action. Header row carries name, price and the
          action; benefits sit in one grid underneath. */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {litePlan && (
          <div
            className="border rounded-2xl p-4 relative"
            style={{ borderColor: "#59A2E7" }}
          >
            <h3 className="text-xs font-bold bg-background px-2 text-[#59A2E7] absolute left-1/2 -translate-x-1/2 -top-2.5">
              Lite
            </h3>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-lg font-semibold">{litePlan.label}</span>
                  <span className="text-sm text-muted-foreground">
                    ${litePlan.price} / year
                  </span>
                  {subscription.product_id === litePlan.id && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  For JSON APIs &amp; text content
                </p>
              </div>
              {!subscription.active ? (
                <Link
                  href={getCustomerCheckoutLink(litePlan.link, sessionEmail)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0"
                >
                  <Button
                    size="sm"
                    data-umami-event="pricing-lite"
                    style={{ backgroundColor: "#59A2E7" }}
                  >
                    Upgrade
                  </Button>
                </Link>
              ) : (
                <Link
                  href="/api/portal"
                  target="_blank"
                  className="flex-shrink-0"
                >
                  <Button
                    size="sm"
                    data-umami-event="billing-manage"
                    className="flex items-center gap-2"
                    variant={
                      subscription.product_id === litePlan.id
                        ? "default"
                        : "outline"
                    }
                  >
                    {subscription.product_id === litePlan.id ? (
                      <>
                        Manage <SquareArrowOutUpRight />
                      </>
                    ) : (
                      "Change Plan"
                    )}
                  </Button>
                </Link>
              )}
            </div>
            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#59A2E7] flex-shrink-0" />
                <span>Proxy URL: lite.corsfix.com</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#59A2E7] flex-shrink-0" />
                <span>Unlimited requests &amp; bandwidth</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#59A2E7] flex-shrink-0" />
                <span>Text content (JSON API, HTML, etc)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#59A2E7] flex-shrink-0" />
                <span>600 RPM (shared across users)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#59A2E7] flex-shrink-0" />
                <span>Up to 1 MB per response</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#59A2E7] flex-shrink-0" />
                <span>European infrastructure</span>
              </li>
            </ul>
          </div>
        )}

        {!subscription.active && (
          <div
            className="border rounded-2xl p-4 relative"
            style={{ borderColor: TRIAL_COLOR }}
          >
            <h3
              className="text-xs font-bold bg-background px-2 absolute left-1/2 -translate-x-1/2 -top-2.5"
              style={{ color: TRIAL_COLOR }}
            >
              Trial
            </h3>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-lg font-semibold">Trial</span>
                  <span className="text-sm text-muted-foreground">
                    for {trialDays} days
                  </span>
                  {trialState === "active" && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {trialState === "active" && trialEndsLabel
                    ? `Ends ${trialEndsLabel}`
                    : "Try every feature before you upgrade"}
                </p>
              </div>
              {trialState === "available" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0"
                  data-umami-event="trial-activate"
                  onClick={activateTrial}
                  disabled={activatingTrial}
                >
                  {activatingTrial ? "Activating..." : "Activate"}
                </Button>
              ) : trialState === "active" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0"
                  disabled
                >
                  Trial active
                </Button>
              ) : (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    {/* Disabled buttons drop pointer events, so the
                        tooltip anchors to a wrapper. */}
                    <TooltipTrigger asChild>
                      <span className="flex-shrink-0" tabIndex={0}>
                        <Button size="sm" variant="outline" disabled>
                          Trial used
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      You have used your trial. Upgrade to access all the
                      features.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2 text-sm">
              {trialBenefits.map((benefit, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Check
                    className="h-3.5 w-3.5 flex-shrink-0"
                    style={{ color: TRIAL_COLOR }}
                  />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
