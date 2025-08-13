import { Metric, MetricPoint } from "@/types/api";
import { UserOriginDailyEntity } from "../../models/UserOriginDailyEntity";
import dbConnect from "../dbConnect";
import { CacheableMemory } from "cacheable";

const metricCache = new CacheableMemory({
  ttl: "1m",
  lruSize: 1000,
});

export const getMonthToDateMetrics = async (
  userId: string
): Promise<Metric> => {
  const now = new Date();
  const monthYear = `${now.getUTCFullYear()}-${String(
    now.getUTCMonth() + 1
  ).padStart(2, "0")}`;
  const cacheKey = `mtd_metrics:${userId}:${monthYear}`;

  // Try to get from cache first
  const cachedMetrics = await metricCache.get(cacheKey);
  if (cachedMetrics) {
    return cachedMetrics as Metric;
  }

  await dbConnect();

  const startOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );

  const startOfNextMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );

  const result = await UserOriginDailyEntity.aggregate([
    {
      $match: {
        user_id: userId,
        date: {
          $gte: startOfMonth,
          $lt: startOfNextMonth,
        },
      },
    },
    {
      $group: {
        _id: null,
        req_count: { $sum: "$req_count" },
        bytes: { $sum: "$bytes" },
      },
    },
  ]);

  let metrics: Metric;
  if (result.length > 0) {
    metrics = {
      req_count: result[0].req_count || 0,
      bytes: result[0].bytes || 0,
    };
  } else {
    metrics = {
      req_count: 0,
      bytes: 0,
    };
  }

  // Cache the result for 5 minutes
  await metricCache.set(cacheKey, metrics, "5m");

  return metrics;
};

export const getMetricsDateRange = async (
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<MetricPoint[]> => {
  // Create cache key based on user ID and date range
  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];
  const cacheKey = `date_range_metrics:${userId}:${startDateStr}:${endDateStr}`;

  // Try to get from cache first
  const cachedMetrics = await metricCache.get(cacheKey);
  if (cachedMetrics) {
    return cachedMetrics as MetricPoint[];
  }

  await dbConnect();

  // Validate date range - max 31 days
  const timeDiff = endDate.getTime() - startDate.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

  if (daysDiff > 31) {
    throw new Error("Date range cannot exceed 31 days");
  }

  if (startDate > endDate) {
    throw new Error("Start date must be before end date");
  }

  // Normalize dates to UTC midnight to ensure consistent querying
  const normalizedStartDate = new Date(
    Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate()
    )
  );
  const normalizedEndDate = new Date(
    Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate()
    )
  );

  try {
    // Query metrics for the date range, aggregating by date
    const dbMetrics = await UserOriginDailyEntity.aggregate([
      {
        $match: {
          user_id: userId,
          date: { $gte: normalizedStartDate, $lte: normalizedEndDate },
        },
      },
      {
        $group: {
          _id: "$date",
          totalRequests: { $sum: "$req_count" },
          totalBytes: { $sum: "$bytes" },
        },
      },
      {
        $sort: { _id: 1 }, // Sort by date ascending
      },
    ]);

    // Create a map of existing data for quick lookup
    const metricsMap = new Map<string, { req_count: number; bytes: number }>();
    dbMetrics.forEach((metric) => {
      const dateKey = metric._id.toISOString().split("T")[0]; // Get YYYY-MM-DD format
      metricsMap.set(dateKey, {
        req_count: metric.totalRequests || 0,
        bytes: metric.totalBytes || 0,
      });
    });

    // Generate all dates in the range and populate with data or zeros
    const result: MetricPoint[] = [];
    const currentDate = new Date(normalizedStartDate);

    while (currentDate <= normalizedEndDate) {
      const dateKey = currentDate.toISOString().split("T")[0];
      const existingData = metricsMap.get(dateKey);

      result.push({
        date: new Date(currentDate),
        req_count: existingData?.req_count || 0,
        bytes: existingData?.bytes || 0,
      });

      // Move to next day
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    // Cache the result for 10 minutes
    await metricCache.set(cacheKey, result, "10m");

    return result;
  } catch (error) {
    console.error("Error fetching metrics for date range:", error);
    throw error;
  }
};
