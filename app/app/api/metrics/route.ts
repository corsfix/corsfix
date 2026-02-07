import { auth } from "@/auth";
import { aggregateByDate, getMetricsYearMonth } from "@/lib/services/metricService";
import { getUserId } from "@/lib/utils";
import { GetMetricsSchema } from "@/types/api";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = getUserId(session);

    const { searchParams } = new URL(request.url);
    const yearMonth = searchParams.get("yearMonth");
    const domainsParam = searchParams.get("domains") || undefined;

    // Validate the request parameters
    const validationResult = GetMetricsSchema.safeParse({
      yearMonth,
      domains: domainsParam,
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

    const { yearMonth: validYearMonth, domains: validDomains } = validationResult.data;

    // Parse comma-separated domains into array
    const domainsArray = validDomains
      ? validDomains.split(",").filter(Boolean)
      : undefined;

    // Get granular per-domain data (cached), then filter + aggregate in app layer
    const domainPoints = await getMetricsYearMonth(userId, validYearMonth);
    const metrics = aggregateByDate(domainPoints, validYearMonth, domainsArray);

    // Extract available domains from the full (unfiltered) dataset
    const availableDomains = [
      ...new Set(domainPoints.map((p) => p.origin_domain).filter(Boolean)),
    ].sort();

    return NextResponse.json({
      success: true,
      message: "Metrics retrieved successfully",
      data: { metrics, availableDomains },
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
