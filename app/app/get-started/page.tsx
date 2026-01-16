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
import { ExternalLink, NotepadText } from "lucide-react";
import { ApiKeyButton } from "@/components/api-key-button";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getProxyDomain, getTrialEnds, isTrialActive } from "@/lib/utils";
import { IS_CLOUD } from "@/config/constants";

export const metadata: Metadata = {
  title: "Get Started | Corsfix Dashboard",
};

export default async function GetStarted() {
  const session = await auth();
  let subscription, planDescription;

  try {
    const isTrial = isTrialActive(session);

    if (!session?.user.id) {
      throw Error("Unauthenticated.");
    }
    subscription = await getActiveSubscription(session.user.id);

    if (subscription.active) {
      planDescription =
        "You have access to use Corsfix on live web applications.";
    } else if (isTrial) {
      const trialEnds = getTrialEnds(session);
      const formattedDate = trialEnds.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      subscription.name = `trial (until ${formattedDate})`;
      planDescription =
        "Try all the features for free. Upgrade to keep using Corsfix on live web applications.";
    } else {
      planDescription = "Upgrade to use Corsfix on live web applications.";
    }
  } catch (error: unknown) {
    console.error(JSON.stringify(error, null, 2));
    subscription = { active: false, name: "-" };
  }

  return (
    <>
      <Nav />
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4 inline-flex items-center">
          <NotepadText size={28} className="mr-2" />
          Get Started with Corsfix
        </h1>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                Add your web application
              </CardTitle>
              <CardDescription>
                Set up your website domain to start using Corsfix.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Link href="/applications">
                  <Button data-umami-event="get-started-applications">
                    Add Application
                  </Button>
                </Link>
                <ApiKeyButton />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-6 py-6">
              <div className="flex w-full flex-col md:flex-row md:mb-0">
                <div className="w-full md:w-1/2">
                  <h3 className="text-xl font-semibold mb-2">
                    Use Corsfix in your website
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Add the proxy in your request and integrate with your
                    existing code.
                  </p>
                  <div className="flex flex-wrap my-6 md:mb-0 gap-2">
                    <Link
                      href="https://corsfix.com/docs/code-examples/overview"
                      target="_blank"
                      data-umami-event="get-started-code-example"
                      className="inline-block"
                    >
                      <Button variant="secondary">
                        Code examples{" "}
                        <ExternalLink size={16} className="inline" />
                      </Button>
                    </Link>
                    <Link
                      href="https://corsfix.com/docs/platform/overview"
                      target="_blank"
                      data-umami-event="get-started-platform-integrations"
                      className="inline-block"
                    >
                      <Button variant="secondary">
                        Hosting platform{" "}
                        <ExternalLink size={16} className="inline" />
                      </Button>
                    </Link>
                  </div>
                </div>
                <div className="w-full md:w-1/2 flex items-center overflow-x-auto">
                  <pre className="overflow-x-auto text-sm w-full border px-2 md:px-3 py-4 rounded-lg">
                    <code lang="javascript">
                      {`// Example usage with fetch
const url = "https://api.example.com"
fetch("https://${
                        IS_CLOUD ? "proxy.corsfix.com" : getProxyDomain()
                      }/?" + url);`}
                    </code>
                  </pre>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
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
                      View docs <ExternalLink size={16} className="inline" />
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
                  Current plan:{" "}
                  <span className="text-primary">
                    {subscription.name.charAt(0).toUpperCase() +
                      subscription.name.slice(1)}
                  </span>
                </CardTitle>
                <CardDescription>{planDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Link href="/billing">
                    {subscription.active ? (
                      <Button
                        variant="secondary"
                        data-umami-event="get-started-benefits"
                      >
                        See benefits
                      </Button>
                    ) : (
                      <Button data-umami-event="get-started-upgrade">
                        Upgrade Plan
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
