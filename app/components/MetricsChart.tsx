"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DomainFilter } from "@/components/DomainFilter";
import { useState } from "react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatBytes, formatNumber } from "@/lib/utils";
import { MetricPoint } from "@/types/api";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

interface MetricsChartProps {
  data: MetricPoint[];
  availableDomains: string[];
  selectedDomains: string[];
  onSelectedDomainsChange: (domains: string[]) => void;
}

export default function MetricsChart({
  data,
  availableDomains,
  selectedDomains,
  onSelectedDomainsChange,
}: MetricsChartProps) {
  const [showRequests, setShowRequests] = useState(true);
  const [showBytes, setShowBytes] = useState(true);

  const handleShowRequestsChange = (checked: boolean) => {
    if (!checked && !showBytes) return;
    setShowRequests(checked);
  };

  const handleShowBytesChange = (checked: boolean) => {
    if (!checked && !showRequests) return;
    setShowBytes(checked);
  };

  const isRequestsDisabled = showRequests && !showBytes;
  const isBytesDisabled = showBytes && !showRequests;

  // Calculate totals from current data
  const totals = data.reduce(
    (acc, point) => ({
      requests: acc.requests + point.req_count,
      bytes: acc.bytes + point.bytes,
    }),
    { requests: 0, bytes: 0 }
  );

  // Format chart data
  const chartData = data.map((point) => ({
    date: new Date(point.date).toISOString().split("T")[0],
    requests: showRequests ? point.req_count : 0,
    bytes: showBytes ? point.bytes : 0,
  }));

  // Normalize bytes to a reasonable scale (convert to MB for better visualization)
  const maxRequests = Math.max(...data.map((p) => p.req_count));
  const maxBytes = Math.max(...data.map((p) => p.bytes));
  const bytesToMB = (bytes: number) => bytes / (1000 * 1000);
  const scaleFactor =
    maxRequests > 0 && maxBytes > 0 ? maxRequests / bytesToMB(maxBytes) : 1;

  const normalizedChartData = chartData.map((item) => ({
    ...item,
    bytesMB: bytesToMB(item.bytes),
    bytesNormalized: bytesToMB(item.bytes) * scaleFactor,
  }));

  const chartConfig = {
    requests: {
      label: "Requests",
      color: "hsl(var(--chart-1))",
    },
    bytes: {
      label: "Bytes",
      color: "hsl(var(--chart-2))",
    },
  };

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-stretch border-b p-0 mb-8 overflow-x-scroll">
        <div className="flex">
          <button
            data-active={showRequests}
            className="data-[active=true]:bg-chart-1/80 flex flex-col justify-center p-4 w-32 text-left border-r rounded-tl-xl"
            onClick={() => handleShowRequestsChange(!showRequests)}
            disabled={isRequestsDisabled}
          >
            <span className="text-xs mb-2">{chartConfig.requests.label}</span>
            <span className="text-xl leading-none font-bold">
              {formatNumber(totals.requests)}
            </span>
          </button>
          <button
            data-active={showBytes}
            className="data-[active=true]:bg-chart-2/80 flex flex-col justify-center p-4 w-32 text-left border-r"
            onClick={() => handleShowBytesChange(!showBytes)}
            disabled={isBytesDisabled}
          >
            <span className="text-xs mb-2">{chartConfig.bytes.label}</span>
            <span className="text-xl leading-none font-bold whitespace-nowrap">
              {formatBytes(totals.bytes)}
            </span>
          </button>
        </div>

        <div className="flex gap-2 p-3">
          <DomainFilter
            availableDomains={availableDomains}
            selectedDomains={selectedDomains}
            onSelectionChange={onSelectedDomainsChange}
          />
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={normalizedChartData}
              margin={{ right: 0, left: -15 }}
            >
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
                yAxisId="left"
                orientation="left"
                label={{
                  value: "Requests",
                  angle: -90,
                  position: "insideLeft",
                  dx: 15,
                  style: {
                    textAnchor: "middle",
                    fill: "var(--color-requests)",
                  },
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{
                  value: "Bytes (MB)",
                  angle: 90,
                  position: "insideRight",
                  dx: 0,
                  style: {
                    textAnchor: "middle",
                    fill: "var(--color-bytes)",
                  },
                }}
              />
              <ChartTooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <ChartTooltipContent
                        active={active}
                        payload={payload.map((p) => ({
                          ...p,
                          value:
                            p.dataKey === "bytesMB"
                              ? `${typeof p.value === "number"
                                ? p.value.toFixed(2)
                                : p.value
                              } MB`
                              : p.value,
                        }))}
                        label={new Date(
                          label + "T00:00:00.000Z"
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      />
                    );
                  }
                  return null;
                }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="requests"
                stroke="var(--color-requests)"
                strokeWidth={2}
                name="Requests"
                dot={false}
                hide={!showRequests}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="bytesMB"
                stroke="var(--color-bytes)"
                strokeWidth={2}
                name="Bytes"
                dot={false}
                hide={!showBytes}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
