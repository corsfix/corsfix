import {
  updateApplication,
  deleteApplication,
} from "@/lib/services/applicationService";
import {
  UpsertApplication,
  ApiResponse,
  Application,
  UpsertApplicationSchema,
} from "@/types/api";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserId } from "@/lib/utils";
import { checkApplicationUpsert } from "@/lib/services/applicationValidation";
import * as z from "zod";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const idToken = getUserId(session);

  const json = await request.json();
  const body: UpsertApplication = UpsertApplicationSchema.parse(json);

  const paramId = (await params).id;
  const id = z.string().max(32).parse(paramId);

  const error = await checkApplicationUpsert(session, id, body);
  if (error) {
    return NextResponse.json<ApiResponse<null>>(
      { data: null, message: error, success: false },
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

  const paramId = (await params).id;
  const id = z.string().max(32).parse(paramId);

  return NextResponse.json<ApiResponse<void>>({
    data: await deleteApplication(idToken, id),
    message: "success",
    success: true,
  });
}
