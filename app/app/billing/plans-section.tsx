"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, SquareArrowOutUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BillingCycle, Product } from "@/config/constants";
import type { Subscription } from "@/types/api";

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
}

export function PlansSection({
  products,
  subscription,
  sessionEmail,
  defaultBillingCycle,
}: PlansSectionProps) {
  const [billingCycle, setBillingCycle] =
    useState<BillingCycle>(defaultBillingCycle);

  const standardPlans = products.filter(
    (p) => p.type === "standard" && p.billingCycle === billingCycle
  );
  const litePlan = products.find((p) => p.type === "lite");

  return (
    <div className="mt-6">
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

      {litePlan && (
        <div
          className="mt-6 border-2 rounded-2xl p-2 relative"
          style={{ borderColor: "#59A2E7" }}
        >
          <h3 className="text-sm font-bold bg-background px-2 text-[#59A2E7] absolute left-1/2 -translate-x-1/2 -top-3">
            Lite
          </h3>
          <Card className="snap-center">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl">{litePlan.label}</CardTitle>
                    {subscription.product_id === litePlan.id && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex items-end gap-2 mt-3">
                    <span className="text-3xl font-bold">${litePlan.price}</span>
                    <span className="text-muted-foreground pb-1">/ year</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    For JSON APIs & text content
                  </p>
                </div>
                <ul className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#59A2E7] flex-shrink-0" />
                    <span>Proxy URL: lite.corsfix.com</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#59A2E7] flex-shrink-0" />
                    <span>Unlimited requests &amp; bandwidth</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#59A2E7] flex-shrink-0" />
                    <span>Text content (JSON API, HTML, etc)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#59A2E7] flex-shrink-0" />
                    <span>600 RPM (shared across users)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#59A2E7] flex-shrink-0" />
                    <span>Up to 1 MB per response</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#59A2E7] flex-shrink-0" />
                    <span>European infrastructure</span>
                  </li>
                </ul>
                <div className="flex-shrink-0 md:w-40">
                  {!subscription.active ? (
                    <Link
                      href={getCustomerCheckoutLink(
                        litePlan.link,
                        sessionEmail
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        className="w-full"
                        data-umami-event="pricing-lite"
                        style={{ backgroundColor: "#59A2E7" }}
                      >
                        Upgrade
                      </Button>
                    </Link>
                  ) : (
                    <Link href="/api/portal" target="_blank">
                      <Button
                        data-umami-event="billing-manage"
                        className="w-full flex items-center gap-2"
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
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
