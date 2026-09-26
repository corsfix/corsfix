import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";
import { auth } from "@/auth";
import { ApiResponse } from "@/types/api";
import { revokeGrant } from "@/lib/oauth/tokenService";

export const dynamic = "force-dynamic";

// Disconnects an MCP app: removes the connection and every token issued to it.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json<ApiResponse<null>>(
      { data: null, message: "Unauthorized", success: false },
      { status: 401 }
    );
  }

  const id = z
    .string()
    .max(64)
    .parse((await params).id);
  const revoked = await revokeGrant(userId, id);
  if (!revoked) {
    return NextResponse.json<ApiResponse<null>>(
      { data: null, message: "Connection not found", success: false },
      { status: 404 }
    );
  }

  return NextResponse.json<ApiResponse<null>>({
    data: null,
    message: "Disconnected",
    success: true,
  });
}
