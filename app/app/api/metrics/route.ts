import { auth } from "@/auth";
import { getMetricsYearMonth } from "@/lib/services/metricService";
import { getUserId } from "@/lib/utils";
import { GetMetricsSchema } from "@/types/api";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = getUserId(session);

    const { searchParams } = new URL(request.url);
    const yearMonth = searchParams.get("yearMonth");

    // Validate the request parameters
    const validationResult = GetMetricsSchema.safeParse({
      yearMonth,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid year month parameter. Expected YYYY-MM format",
          data: null,
        },
        { status: 400 }
      );
    }

    const { yearMonth: validYearMonth } = validationResult.data;

    // Get metrics for the month
    const metrics = await getMetricsYearMonth(userId, validYearMonth);

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
      if (error.message.includes("Invalid year month format")) {
        errorMessage = "Invalid year month format. Expected YYYY-MM";
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
