import { UserOriginDailyEntity } from "../../models/UserOriginDailyEntity";
import dbConnect from "../dbConnect";

export interface MetricsData {
  last30Days: {
    requestCount: number;
    bandwidthUsed: number;
  };
  last7Days: {
    requestCount: number;
    bandwidthUsed: number;
  };
  today: {
    requestCount: number;
    bandwidthUsed: number;
  };
}

export async function getMetrics(userId: string): Promise<MetricsData> {
  await dbConnect();

  // Get today's date in UTC
  const today = new Date();
  const todayKey = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  const last7DaysKey = new Date(todayKey);
  last7DaysKey.setUTCDate(last7DaysKey.getUTCDate() - 7);

  const last30DaysKey = new Date(todayKey);
  last30DaysKey.setUTCDate(last30DaysKey.getUTCDate() - 30);

  try {
    // Query today's metrics - aggregate all origins for this user and date
    const todayMetrics = await UserOriginDailyEntity.aggregate([
      {
        $match: {
          user_id: userId,
          date: todayKey,
        },
      },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: "$req_count" },
          totalBytes: { $sum: "$bytes" },
        },
      },
    ]);

    // Query last 7 days metrics
    const last7DaysMetrics = await UserOriginDailyEntity.aggregate([
      {
        $match: {
          user_id: userId,
          date: { $gte: last7DaysKey, $lte: todayKey },
        },
      },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: "$req_count" },
          totalBytes: { $sum: "$bytes" },
        },
      },
    ]);

    // Query last 30 days metrics
    const last30DaysMetrics = await UserOriginDailyEntity.aggregate([
      {
        $match: {
          user_id: userId,
          date: { $gte: last30DaysKey, $lte: todayKey },
        },
      },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: "$req_count" },
          totalBytes: { $sum: "$bytes" },
        },
      },
    ]);

    const todayData =
      todayMetrics.length > 0
        ? todayMetrics[0]
        : { totalRequests: 0, totalBytes: 0 };
    const last7DaysData =
      last7DaysMetrics.length > 0
        ? last7DaysMetrics[0]
        : { totalRequests: 0, totalBytes: 0 };
    const last30DaysData =
      last30DaysMetrics.length > 0
        ? last30DaysMetrics[0]
        : { totalRequests: 0, totalBytes: 0 };

    // Ensure we return numbers (not null/undefined)
    const result = {
      last30Days: {
        requestCount: Math.max(0, last30DaysData.totalRequests || 0),
        bandwidthUsed: Math.max(0, last30DaysData.totalBytes || 0),
      },
      last7Days: {
        requestCount: Math.max(0, last7DaysData.totalRequests || 0),
        bandwidthUsed: Math.max(0, last7DaysData.totalBytes || 0),
      },
      today: {
        requestCount: Math.max(0, todayData.totalRequests || 0),
        bandwidthUsed: Math.max(0, todayData.totalBytes || 0),
      },
    };

    return result;
  } catch (error) {
    console.error("Error fetching metrics:", error);
    // Return default values on error
    return {
      last30Days: {
        requestCount: 0,
        bandwidthUsed: 0,
      },
      last7Days: {
        requestCount: 0,
        bandwidthUsed: 0,
      },
      today: {
        requestCount: 0,
        bandwidthUsed: 0,
      },
    };
  }
}

// Helper function to format bytes into human-readable format
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Helper function to format large numbers
export function formatNumber(num: number): string {
  if (num === 0) return "0";

  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }

  return num.toString();
}
