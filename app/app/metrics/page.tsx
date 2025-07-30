import Nav from "@/components/nav";
import {
  getMetrics,
  formatBytes,
  formatNumber,
} from "@/lib/services/metricService";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Activity } from "lucide-react";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getUserId } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Metrics | Corsfix Dashboard",
};

export default async function MetricsPage() {
  const session = await auth();

  let idToken, metrics;

  try {
    idToken = getUserId(session);
    metrics = await getMetrics(idToken);
  } catch (error: unknown) {
    console.error(JSON.stringify(error, null, 2));
    idToken = null;
    // Default metrics for unauthenticated users
    metrics = {
      last30Days: { requestCount: 0, bandwidthUsed: 0 },
      last7Days: { requestCount: 0, bandwidthUsed: 0 },
      today: { requestCount: 0, bandwidthUsed: 0 },
    };
  }

  return (
    <>
      <Nav />
      <div className="p-4">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">Metrics</h1>
          <Badge variant="outline" className="text-xs">
            Preview
          </Badge>
        </div>
        <p className="text-muted-foreground mb-6">
          Track your API usage and bandwidth consumption
        </p>

        {/* Header Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Requests (Last 30 Days)
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatNumber(metrics.last30Days.requestCount)} requests
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Bandwidth Used (Last 30 Days)
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatBytes(metrics.last30Days.bandwidthUsed)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Metrics Table */}
        <Card>
          <CardHeader>
            <CardTitle>Usage Overview</CardTitle>
            <CardDescription>
              Detailed breakdown of your API usage across different time periods
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Period
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Request Count
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Bandwidth Used
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b hover:bg-muted/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-medium">Last 30 Days</div>
                      <div className="text-sm text-muted-foreground">
                        Rolling 30-day period
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-semibold">
                          {formatNumber(metrics.last30Days.requestCount)}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-semibold">
                          {formatBytes(metrics.last30Days.bandwidthUsed)}
                        </span>
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b hover:bg-muted/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-medium">Last 7 Days</div>
                      <div className="text-sm text-muted-foreground">
                        Rolling weekly period
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-semibold">
                          {formatNumber(metrics.last7Days.requestCount)}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-semibold">
                          {formatBytes(metrics.last7Days.bandwidthUsed)}
                        </span>
                      </div>
                    </td>
                  </tr>
                  <tr className="hover:bg-muted/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-medium">Today</div>
                      <div className="text-sm text-muted-foreground">
                        Current day (UTC)
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-mono text-lg font-semibold">
                        {formatNumber(metrics.today.requestCount)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-mono text-lg font-semibold">
                        {formatBytes(metrics.today.bandwidthUsed)}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Info Section */}
        <div className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>Note:</strong> Metrics are displayed in UTC timezone
                  to ensure consistency.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
