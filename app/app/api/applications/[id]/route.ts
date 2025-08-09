import {
  updateApplication,
  deleteApplication,
  hasApplicationWithOrigins,
} from "@/lib/services/applicationService";
import { authorize } from "@/lib/services/authorizationService";
import {
  UpsertApplication,
  ApiResponse,
  Application,
  UpsertApplicationSchema,
} from "@/types/api";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserId } from "@/lib/utils";
import * as z from "zod";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const paramId = (await params).id;
  const id = z.string().max(32).parse(paramId);

  const existingOrigins = await hasApplicationWithOrigins(
    id,
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
    data: await updateApplication(idToken, id, body),
    message: "success",
    success: true,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const paramId = (await params).id;
  const id = z.string().max(32).parse(paramId);

  return NextResponse.json<ApiResponse<void>>({
    data: await deleteApplication(idToken, id),
    message: "success",
    success: true,
  });
}
