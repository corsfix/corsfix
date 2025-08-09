import {
  ApiResponse,
  Application,
  UpsertApplication,
  UpsertApplicationSchema,
} from "@/types/api";
import { NextRequest, NextResponse } from "next/server";
import {
  createApplication,
  hasApplicationWithOrigins,
} from "@/lib/services/applicationService";
import { authorize } from "@/lib/services/authorizationService";
import { auth } from "@/auth";
import { getUserId } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const session = await auth();
  const idToken = getUserId(session);

  if (!(await authorize(idToken, "manage_applications"))) {
    return NextResponse.json<ApiResponse<null>>(
      {
        data: null,
        message: "Unauthorized",
        success: false,
      },
      { status: 403 }
    );
  }

  const json = await request.json();
  const body: UpsertApplication = UpsertApplicationSchema.parse(json);

  const existingOrigins = await hasApplicationWithOrigins(
    null,
    body.originDomains
  );
  if (existingOrigins.length > 0) {
    return NextResponse.json<ApiResponse<null>>(
      {
        data: null,
        message: `An application with this origin already exists: ${existingOrigins.join(
          ", "
        )}`,
        success: false,
      },
      { status: 400 }
    );
  }

  return NextResponse.json<ApiResponse<Application>>({
    data: await createApplication(idToken, body),
    message: "success",
    success: true,
  });
}
