import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Nav from "@/components/nav";
import { getActiveSubscription } from "@/lib/services/subscriptionService";
import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getUserId } from "@/lib/utils";
import { IS_CLOUD } from "@/config/constants";

export const metadata: Metadata = {
  title: "Get Started | Corsfix Dashboard",
};

export default async function GetStarted() {
  const session = await auth();

  let idToken, subscription;

  try {
    idToken = getUserId(session);
    subscription = await getActiveSubscription(idToken);
  } catch (error: unknown) {
    console.error(JSON.stringify(error, null, 2));
    idToken = null;
    subscription = { active: false, name: "Free" };
  }

  const isFreePlan = !subscription.active || subscription.name === "Free";

  return (
    <>
      <Nav />
      <div className="p-4">
        <h1 className="text-3xl font-bold mb-6">Get Started with Corsfix</h1>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Playground</CardTitle>
              <CardDescription>
                Test and experiment using Corsfix to bypass CORS errors.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Link href="/playground">
                  <Button data-umami-event="get-started-playground">
                    Open Playground
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <div className="p-6">
              <div className="flex w-full justify-between flex-col md:flex-row mb-4 md:mb-0">
                <div>
                  <h3 className="text-xl font-semibold mb-2">
                    Use Corsfix in Your Code
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Simple integration with your existing requests.
                  </p>
                </div>
                <div className="flex items-center overflow-x-auto">
                  <pre className="overflow-x-auto text-sm w-full border px-2 md:px-3 py-4 rounded-lg">
                    <code lang="javascript">
                      {`// basic usage with fetch
fetch("https://proxy.corsfix.com/?https://api.example.com");`}
                    </code>
                  </pre>
                </div>
              </div>
              <Link
                href="https://corsfix.com/docs/code-examples/fetch"
                target="_blank"
                data-umami-event="get-started-code-example"
              >
                <Button variant="secondary">
                  See all integrations{" "}
                  <ExternalLink size={16} className="inline" />
                </Button>
              </Link>
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Add Your Application</CardTitle>
                <CardDescription>
                  Set up your production application to use Corsfix.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Link href="/applications">
                    <Button data-umami-event="get-started-applications">
                      Add Application
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Documentation</CardTitle>
                <CardDescription>
                  Learn how to integrate and use Corsfix with our documentation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Link
                    href="https://corsfix.com/docs"
                    target="_blank"
                    data-umami-event="get-started-docs"
                  >
                    <Button variant="secondary">
                      View Docs <ExternalLink size={16} className="inline" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {IS_CLOUD && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">
                  Current Plan:{" "}
                  <span className="text-primary">
                    {subscription.name.charAt(0).toUpperCase() +
                      subscription.name.slice(1)}
                  </span>
                </CardTitle>
                <CardDescription>
                  {isFreePlan
                    ? "Use Corsfix for free in your development environment. Upgrade to use Corsfix in production and unlock all the benefits."
                    : "You have access to use Corsfix in production, along with all the benefits of your plan."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Link href="/billing">
                    {isFreePlan ? (
                      <Button data-umami-event="get-started-upgrade">
                        Upgrade Plan
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        data-umami-event="get-started-benefits"
                      >
                        See Benefits
                      </Button>
                    )}
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
