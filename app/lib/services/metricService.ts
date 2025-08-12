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

export async function getThisMonthBandwidth(userId: string): Promise<number> {
  await dbConnect();

  // Get current date in UTC
  const now = new Date();

  // First day of this month (UTC)
  const thisMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );

  // First day of next month (UTC)
  const nextMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );

  try {
    // Query this month's bandwidth usage
    const thisMonthMetrics = await UserOriginDailyEntity.aggregate([
      {
        $match: {
          user_id: userId,
          date: {
            $gte: thisMonthStart,
            $lt: nextMonthStart,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalBytes: { $sum: "$bytes" },
        },
      },
    ]);

    const thisMonthData =
      thisMonthMetrics.length > 0 ? thisMonthMetrics[0] : { totalBytes: 0 };

    return Math.max(0, thisMonthData.totalBytes || 0);
  } catch (error) {
    console.error("Error fetching this month's bandwidth:", error);
    return 0;
  }
}

export async function getThisMonthRequests(userId: string): Promise<number> {
  await dbConnect();

  // Get current date in UTC
  const now = new Date();

  // First day of this month (UTC)
  const thisMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );

  // First day of next month (UTC)
  const nextMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );

  try {
    // Query this month's request count
    const thisMonthMetrics = await UserOriginDailyEntity.aggregate([
      {
        $match: {
          user_id: userId,
          date: {
            $gte: thisMonthStart,
            $lt: nextMonthStart,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: "$req_count" },
        },
      },
    ]);

    const thisMonthData =
      thisMonthMetrics.length > 0 ? thisMonthMetrics[0] : { totalRequests: 0 };

    return Math.max(0, thisMonthData.totalRequests || 0);
  } catch (error) {
    console.error("Error fetching this month's requests:", error);
    return 0;
  }
}
