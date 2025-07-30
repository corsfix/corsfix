import { NextRequest, NextResponse } from "next/server";

// Define types for request and response
interface CorsTestRequest {
  target_url: string;
  origin: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
}

interface CorsTestResponse {
  status: number;
  headers: Record<string, string>;
  error?: string;
}

const getOrigin = () => {
  return process.env.NODE_ENV === "development"
    ? "http://localhost:4321"
    : "https://corsfix.com";
};

// Validate the incoming request
function validateRequest(request: CorsTestRequest): string | null {
  if (!request.target_url) {
    return "Missing target_url parameter";
  }
  if (!request.method) {
    return "Missing method parameter";
  }

  try {
    new URL(request.target_url);
  } catch (err) {
    console.log("Invalid target URL format:", err);
    return "Invalid target URL format";
  }

  const validMethods = [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "OPTIONS",
    "PATCH",
    "HEAD",
  ];
  if (!validMethods.includes(request.method.toUpperCase())) {
    return `Invalid method. Must be one of: ${validMethods.join(", ")}`;
  }

  return null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Parse the request body
    const requestData: CorsTestRequest = await req.json();

    // Validate the request
    const validationError = validateRequest(requestData);
    if (validationError) {
      const errorResponse: CorsTestResponse = {
        status: 0,
        headers: {},
        error: validationError,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Configure the fetch request
    const fetchOptions: RequestInit = {
      method: requestData.method,
      headers: {
        ...(requestData.headers || {}),
        Origin: requestData.origin,
      },
      body: requestData.body,
    };

    // Execute the request to the target URL
    const response = await fetch(requestData.target_url, fetchOptions);

    // Process headers into a JSON object
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Create the standardized response (no body included)
    const corsTestResponse: CorsTestResponse = {
      status: response.status,
      headers,
    };

    // Return the response to the client
    return NextResponse.json(corsTestResponse, {
      headers: {
        "Access-Control-Allow-Origin": getOrigin(),
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    // Handle any unexpected errors
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    const corsTestResponse: CorsTestResponse = {
      status: 0,
      headers: {},
      error: errorMessage,
    };

    // Log the error
    console.error("CORS test error:", error);

    // Return error response
    return NextResponse.json(corsTestResponse, {
      status: 200, // Use 200 so the frontend can properly display the error
      headers: {
        "Access-Control-Allow-Origin": getOrigin(),
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
}

// Also handle OPTIONS requests for preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": getOrigin(),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
