"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { MetricPoint } from "@/types/api";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

interface ConcurrencyChartProps {
  data: MetricPoint[];
  concurrencyLimit?: number;
}

const chartConfig = {
  peakConcurrent: {
    label: "Peak Concurrent Users",
    color: "hsl(var(--chart-3))",
  },
};

export default function ConcurrencyChart({
  data,
  concurrencyLimit,
}: ConcurrencyChartProps) {
  const chartData = data.map((point) => ({
    date: new Date(point.date).toISOString().split("T")[0],
    peakConcurrent: point.peak_concurrent ?? 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Daily Peak Concurrent Users</CardTitle>
        <CardDescription>
          The highest number of unique users using your apps at the same time
          on a given day.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ right: 20, left: -15 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value + "T00:00:00.000Z");
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  });
                }}
              />
              <YAxis
                domain={[
                  0,
                  (dataMax: number) =>
                    Math.max(dataMax, concurrencyLimit ?? 0) * 1.2,
                ]}
              />
              <ChartTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const peak = payload[0]?.value as number | undefined;
                  return (
                    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                      <div className="mb-1 font-medium">
                        {new Date(
                          label + "T00:00:00.000Z"
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor: "var(--color-peakConcurrent)",
                            }}
                          />
                          Peak Concurrency
                        </span>
                        <span className="font-mono font-medium">{peak}</span>
                      </div>
                      {concurrencyLimit ? (
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full border border-dashed"
                              style={{
                                borderColor: "var(--color-peakConcurrent)",
                              }}
                            />
                            Concurrency Limit
                          </span>
                          <span className="font-mono font-medium">
                            {concurrencyLimit}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="peakConcurrent"
                stroke="var(--color-peakConcurrent)"
                strokeWidth={2}
                name="Peak Concurrent Users"
                dot={false}
              />
              {concurrencyLimit ? (
                <ReferenceLine
                  y={concurrencyLimit}
                  stroke="var(--color-peakConcurrent)"
                  strokeDasharray="4 4"
                  label={{
                    value: `Concurrency Limit: ${concurrencyLimit}`,
                    position: "insideTopRight",
                    fill: "var(--color-peakConcurrent)",
                    fontSize: 11,
                  }}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
