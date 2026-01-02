import { ApiResponse } from "@/types/api";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getApiKey,
  generateApiKey,
  deleteApiKey,
} from "@/lib/services/apiKeyService";

export async function GET() {
  const session = await auth();
  const userId = session?.user.id;

  if (!userId) {
    return NextResponse.json<ApiResponse<null>>(
      { data: null, message: "Unauthorized", success: false },
      { status: 401 }
    );
  }

  const apiKey = await getApiKey(userId);

  return NextResponse.json<ApiResponse<{ api_key: string | null }>>({
    data: { api_key: apiKey },
    message: "success",
    success: true,
  });
}

export async function POST() {
  const session = await auth();
  const userId = session?.user.id;

  if (!userId) {
    return NextResponse.json<ApiResponse<null>>(
      { data: null, message: "Unauthorized", success: false },
      { status: 401 }
    );
  }

  const apiKey = await generateApiKey(userId);

  return NextResponse.json<ApiResponse<{ api_key: string }>>({
    data: { api_key: apiKey },
    message: "API key generated",
    success: true,
  });
}

export async function DELETE() {
  const session = await auth();
  const userId = session?.user.id;

  if (!userId) {
    return NextResponse.json<ApiResponse<null>>(
      { data: null, message: "Unauthorized", success: false },
      { status: 401 }
    );
  }

  await deleteApiKey(userId);

  return NextResponse.json<ApiResponse<null>>({
    data: null,
    message: "API key deleted",
    success: true,
  });
}
