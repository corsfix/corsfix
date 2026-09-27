import {
  ApiResponse,
  Application,
  UpsertApplication,
  UpsertApplicationSchema,
} from "@/types/api";
import { NextRequest, NextResponse } from "next/server";
import { createApplication } from "@/lib/services/applicationService";
import { authorize } from "@/lib/services/authorizationService";
import { checkApplicationUpsert } from "@/lib/services/applicationValidation";
import { auth } from "@/auth";
import { getUserId } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = getUserId(session);

  const authz = await authorize(session, "add_applications");
  if (!authz.allowed) {
    return NextResponse.json<ApiResponse<null>>(
      {
        data: null,
        message: authz.message || "Unauthorized",
        success: false,
      },
      { status: 403 }
    );
  }

  const json = await request.json();
  const body: UpsertApplication = UpsertApplicationSchema.parse(json);

  const error = await checkApplicationUpsert(session, null, body);
  if (error) {
    return NextResponse.json<ApiResponse<null>>(
      { data: null, message: error, success: false },
      { status: 400 }
    );
  }

  return NextResponse.json<ApiResponse<Application>>({
    data: await createApplication(userId, body),
    message: "success",
    success: true,
  });
}
