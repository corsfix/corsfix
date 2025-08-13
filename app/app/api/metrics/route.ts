import { auth } from "@/auth";
import { getMetricsDateRange } from "@/lib/services/metricService";
import { getUserId } from "@/lib/utils";
import { GetMetricsSchema } from "@/types/api";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = getUserId(session);

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Validate the request parameters
    const validationResult = GetMetricsSchema.safeParse({
      startDate,
      endDate,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid date parameters",
          data: null,
        },
        { status: 400 }
      );
    }

    const { startDate: validStartDate, endDate: validEndDate } = validationResult.data;

    // Convert strings to Date objects
    const start = new Date(validStartDate);
    const end = new Date(validEndDate);

    // Get metrics for the date range
    const metrics = await getMetricsDateRange(userId, start, end);

    return NextResponse.json({
      success: true,
      message: "Metrics retrieved successfully",
      data: metrics,
    });
  } catch (error) {
    console.error("Error fetching metrics:", error);
    
    let errorMessage = "Internal server error";
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes("Date range cannot exceed 31 days")) {
        errorMessage = "Date range cannot exceed 31 days";
        statusCode = 400;
      } else if (error.message.includes("Start date must be before end date")) {
        errorMessage = "Start date must be before end date";
        statusCode = 400;
      } else if (error.message.includes("Invalid token")) {
        errorMessage = "Unauthorized";
        statusCode = 401;
      }
    }

    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
        data: null,
      },
      { status: statusCode }
    );
  }
}
