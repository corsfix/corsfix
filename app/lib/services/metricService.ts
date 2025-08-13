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

  await metricCache.set(cacheKey, metrics);

  return metrics;
};

export const getMetricsYearMonth = async (
  userId: string,
  yearMonth: string
): Promise<MetricPoint[]> => {
  // Validate yearMonth format (YYYY-MM)
  const yearMonthRegex = /^\d{4}-\d{2}$/;
  if (!yearMonthRegex.test(yearMonth)) {
    throw new Error("Invalid year month format. Expected YYYY-MM");
  }

  const cacheKey = `month_metrics:${userId}:${yearMonth}`;

  // Try to get from cache first
  const cachedMetrics = await metricCache.get(cacheKey);
  if (cachedMetrics) {
    return cachedMetrics as MetricPoint[];
  }

  await dbConnect();

  // Parse year and month from yearMonth string
  const [year, month] = yearMonth.split("-").map(Number);

  // Create start and end dates for the month
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const endOfMonth = new Date(Date.UTC(year, month, 0)); // Last day of the month

  try {
    // Query metrics for the month, aggregating by date
    const dbMetrics = await UserOriginDailyEntity.aggregate([
      {
        $match: {
          user_id: userId,
          date: { $gte: startOfMonth, $lte: endOfMonth },
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

    // Generate all dates in the month and populate with data or zeros
    const result: MetricPoint[] = [];
    const currentDate = new Date(startOfMonth);

    while (currentDate <= endOfMonth) {
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

    await metricCache.set(cacheKey, result);

    return result;
  } catch (error) {
    console.error("Error fetching metrics for month:", error);
    throw error;
  }
};
