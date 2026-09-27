import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ApiResponse } from "@/types/api";
import { GrantSummary, listGrants } from "@/lib/oauth/tokenService";

export const dynamic = "force-dynamic";

// Apps the signed-in user has connected through MCP.
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json<ApiResponse<null>>(
      { data: null, message: "Unauthorized", success: false },
      { status: 401 }
    );
  }

  return NextResponse.json<ApiResponse<GrantSummary[]>>({
    data: await listGrants(userId),
    message: "success",
    success: true,
  });
}
