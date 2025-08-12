import {
  ApiResponse,
  SecretItem,
  UpsertSecret,
  UpsertSecretSchema,
} from "@/types/api";
import { NextRequest, NextResponse } from "next/server";
import { getKek } from "@/lib/utils";
import {
  updateSecret,
  deleteSecret,
  secretExistsForApplication,
} from "@/lib/services/secretService";
import { auth } from "@/auth";
import { getUserId } from "@/lib/utils";
import * as z from "zod";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const idToken = getUserId(session);

    const json = await request.json();
    const body: UpsertSecret = UpsertSecretSchema.parse(json);

    const paramId = (await params).id;
    const secretId = z.string().max(32).parse(paramId);

    // Check if a secret with the same name already exists for this application (excluding current secret)
    const secretExists = await secretExistsForApplication(
      idToken,
      body.application_id,
      body.name,
      secretId
    );

    if (secretExists) {
      return NextResponse.json<ApiResponse<null>>(
        {
          data: null,
          message: "A secret with this name already exists.",
          success: false,
        },
        { status: 400 }
      );
    }

    const kek = await getKek();
    if (!kek) {
      return NextResponse.json<ApiResponse<null>>(
        {
          data: null,
          message: "Failed to perform encryption.",
          success: false,
        },
        { status: 500 }
      );
    }

    // Update secret using the secretService
    const secret = await updateSecret(idToken, secretId, kek, body);

    return NextResponse.json<ApiResponse<SecretItem>>({
      data: secret,
      message: "Secret updated successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error updating secret:", error);

    if (error instanceof Error && error.message === "Secret not found") {
      return NextResponse.json<ApiResponse<null>>(
        {
          data: null,
          message: "Secret not found.",
          success: false,
        },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<null>>(
      {
        data: null,
        message: "An unexpected error occurred",
        success: false,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const idToken = getUserId(session);

    const paramId = (await params).id;
    const secretId = z.string().max(32).parse(paramId);

    // Delete secret using the secretService
    await deleteSecret(idToken, secretId);

    return NextResponse.json<ApiResponse<null>>({
      data: null,
      message: "Secret deleted successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error deleting secret:", error);

    if (error instanceof Error && error.message === "Secret not found") {
      return NextResponse.json<ApiResponse<null>>(
        {
          data: null,
          message: "Secret not found.",
          success: false,
        },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<null>>(
      {
        data: null,
        message: "An unexpected error occurred",
        success: false,
      },
      { status: 500 }
    );
  }
}
