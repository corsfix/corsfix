import Nav from "@/components/nav";
import { Card, CardContent } from "@/components/ui/card";
import MetricsView from "@/components/MetricsView";
import { Metadata } from "next/types";
import { auth } from "@/auth";
import { getActiveSubscription } from "@/lib/services/subscriptionService";

export const metadata: Metadata = {
  title: "Metrics | Corsfix Dashboard",
};

export default async function MetricsPage() {
  const session = await auth();
  let concurrencyLimit: number | undefined;
  if (session?.user?.id) {
    try {
      const subscription = await getActiveSubscription(session.user.id);
      concurrencyLimit = subscription.noConcurrencyLimit
        ? undefined
        : subscription.concurrencyLimit;
    } catch (error) {
      console.error("Failed to load subscription for metrics page", error);
    }
  }

  return (
    <>
      <Nav />
      <div className="p-4">
        <MetricsView concurrencyLimit={concurrencyLimit} />

        {/* Info Section */}
        <div className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>Note:</strong> Metrics are displayed in UTC timezone
                  to ensure consistency. Data points represent daily aggregates.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
