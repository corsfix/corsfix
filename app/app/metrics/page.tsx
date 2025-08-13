import Nav from "@/components/nav";
import { Card, CardContent } from "@/components/ui/card";
import { ChartLine } from "lucide-react";
import MetricsChart from "@/components/MetricsChart";
import { Metadata } from "next/types";

export const metadata: Metadata = {
  title: "Metrics | Corsfix Dashboard",
};

export default function MetricsPage() {
  return (
    <>
      <Nav />
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4 inline-flex items-center">
          <ChartLine size={28} className="mr-2" />
          Metrics
        </h1>
        <p className="text-muted-foreground mb-6">
          Track your API usage and bandwidth consumption
        </p>

        <MetricsChart />

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
