"use client";

import { useState, useEffect } from "react";
import Nav from "@/components/nav";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatBytes, formatNumber } from "@/lib/utils";
import { MetricPoint } from "@/types/api";
import { ChartLine } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

type TimeRange = string; // string for custom months

const generateMonthOptions = () => {
  const months = [];
  const now = new Date();

  for (let i = 0; i < 3; i++) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)
    );
    const monthName = date.toLocaleString("default", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    const value = `${date.getUTCFullYear()}-${String(
      date.getUTCMonth() + 1
    ).padStart(2, "0")}`;
    months.push({ value, label: monthName });
  }

  return months;
};

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}`;
};

const MONTH_OPTIONS = generateMonthOptions();

export default function MetricsPage() {
  const [data, setData] = useState<MetricPoint[]>([]);
  const [selectedRange, setSelectedRange] = useState<TimeRange>(
    getCurrentMonth()
  );
  const [showRequests, setShowRequests] = useState(true);
  const [showBytes, setShowBytes] = useState(true);

  // Handle checkbox changes with validation
  const handleShowRequestsChange = (checked: boolean) => {
    // Only allow unchecking if bytes is still checked
    if (!checked && !showBytes) {
      return; // Prevent both from being unchecked
    }
    setShowRequests(checked);
  };

  const handleShowBytesChange = (checked: boolean) => {
    // Only allow unchecking if requests is still checked
    if (!checked && !showRequests) {
      return; // Prevent both from being unchecked
    }
    setShowBytes(checked);
  };

  // Check if a checkbox should be disabled (when it's the only one checked)
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

  // Generate date range based on selection
  const getDateRange = (range: TimeRange): { start: Date; end: Date } => {
    // Handle month selection (YYYY-MM format)
    const [year, month] = range.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 0));
    return { start, end: endOfMonth };
  };

  // Fetch metrics data
  const fetchMetrics = async (range: TimeRange) => {
    try {
      const { start, end } = getDateRange(range);
      const response = await fetch(
        `/api/metrics?startDate=${start.toISOString()}&endDate=${end.toISOString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch metrics");
      }

      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
    }
  };

  // Handle range change
  const handleRangeChange = (range: TimeRange) => {
    setSelectedRange(range);
    fetchMetrics(range);
  };

  // Initial data load
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const currentMonth = getCurrentMonth();
        const { start, end } = getDateRange(currentMonth);
        const response = await fetch(
          `/api/metrics?startDate=${start.toISOString()}&endDate=${end.toISOString()}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch metrics");
        }

        const result = await response.json();
        if (result.success) {
          setData(result.data);
        }
      } catch (error) {
        console.error("Error fetching initial metrics:", error);
      }
    };

    loadInitialData();
  }, []);

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

        <Card>
          <CardHeader className="flex flex-row justify-between items-stretch border-b !p-0 mb-8 overflow-x-scroll">
            <div className="flex">
              <button
                data-active={showRequests}
                className="data-[active=true]:bg-muted/50 flex flex-col justify-center p-4 w-32 text-left border-r"
                onClick={() => handleShowRequestsChange(!showRequests)}
                disabled={isRequestsDisabled}
              >
                <span className="text-muted-foreground text-xs mb-2">
                  {chartConfig.requests.label}
                </span>
                <span className="text-xl leading-none font-bold">
                  {formatNumber(totals.requests)}
                </span>
              </button>
              <button
                data-active={showBytes}
                className="data-[active=true]:bg-muted/50 flex flex-col justify-center p-4 w-32 text-left border-r"
                onClick={() => handleShowBytesChange(!showBytes)}
                disabled={isBytesDisabled}
              >
                <span className="text-muted-foreground text-xs mb-2">
                  {chartConfig.bytes.label}
                </span>
                <span className="text-xl leading-none font-bold whitespace-nowrap">
                  {formatBytes(totals.bytes)}
                </span>
              </button>
            </div>

            <div className="flex gap-2 p-3">
              <Select
                value={
                  MONTH_OPTIONS.some((m) => m.value === selectedRange)
                    ? selectedRange
                    : ""
                }
                onValueChange={handleRangeChange}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={normalizedChartData}
                  margin={{ top: -15, right: -15, left: -15, bottom: -15 }}
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
                  {/* Dynamic Y-Axis positioning based on what's shown */}
                  {showRequests && (
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      tick={{ fontSize: 14 }}
                      label={{
                        value: "Requests",
                        angle: -90,
                        position: "insideLeft",
                        dx: 15,
                        style: { textAnchor: "middle" },
                      }}
                    />
                  )}
                  {showBytes && (
                    <YAxis
                      yAxisId={showRequests ? "right" : "left"}
                      orientation={showRequests ? "right" : "left"}
                      tick={{ fontSize: 14 }}
                      label={{
                        value: "Bytes (MB)",
                        angle: showRequests ? 90 : -90,
                        position: showRequests ? "insideRight" : "insideLeft",
                        dx: showRequests ? -15 : 15,
                        style: { textAnchor: "middle" },
                      }}
                    />
                  )}
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
                                  ? `${
                                      typeof p.value === "number"
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
                  <Legend />
                  {showRequests && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="requests"
                      stroke="var(--color-requests)"
                      strokeWidth={2}
                      name="Requests"
                      dot={false}
                    />
                  )}
                  {showBytes && (
                    <Line
                      yAxisId={showRequests ? "right" : "left"}
                      type="monotone"
                      dataKey="bytesMB"
                      stroke="var(--color-bytes)"
                      strokeWidth={2}
                      name="Bytes"
                      dot={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

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
