"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MetricPoint } from "@/types/api";
import MetricsChart from "@/components/MetricsChart";
import ConcurrencyChart from "@/components/ConcurrencyChart";
import { ChartLine } from "lucide-react";

interface MetricsViewProps {
  concurrencyLimit?: number;
}

const generateMonthOptions = () => {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)
    );
    const monthName = date.toLocaleString("default", {
      month: "short",
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

export default function MetricsView({ concurrencyLimit }: MetricsViewProps) {
  const [data, setData] = useState<MetricPoint[]>([]);
  const [selectedRange, setSelectedRange] = useState<string>(getCurrentMonth());
  const [availableDomains, setAvailableDomains] = useState<string[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);

  const fetchMetrics = async (range: string, domains: string[]) => {
    try {
      const params = new URLSearchParams({ yearMonth: range });
      if (domains.length > 0) {
        params.set("domains", domains.join(","));
      }
      const response = await fetch(`/api/metrics?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch metrics");
      }
      const result = await response.json();
      if (result.success) {
        setData(result.data.metrics);
        const newAvailable: string[] = result.data.availableDomains;
        setAvailableDomains(newAvailable);
        setSelectedDomains((prev) => {
          const valid = prev.filter((d) => newAvailable.includes(d));
          return valid.length === prev.length ? prev : valid;
        });
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
    }
  };

  const handleRangeChange = (range: string) => {
    setSelectedRange(range);
    fetchMetrics(range, selectedDomains);
  };

  const handleDomainChange = (domains: string[]) => {
    setSelectedDomains(domains);
    fetchMetrics(selectedRange, domains);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchMetrics(getCurrentMonth(), []);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold inline-flex items-center">
          <ChartLine size={28} className="mr-2" />
          Metrics
        </h1>
        <Select
          value={
            MONTH_OPTIONS.some((m) => m.value === selectedRange)
              ? selectedRange
              : ""
          }
          onValueChange={handleRangeChange}
        >
          <SelectTrigger className="w-32">
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

      <MetricsChart
        data={data}
        availableDomains={availableDomains}
        selectedDomains={selectedDomains}
        onSelectedDomainsChange={handleDomainChange}
      />

      <ConcurrencyChart data={data} concurrencyLimit={concurrencyLimit} />
    </div>
  );
}
