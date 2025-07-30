import { ApiResponse, SecretItem, UpsertSecret } from "@/types/api";
import { NextRequest, NextResponse } from "next/server";
import { getKek } from "@/lib/utils";
import { authorize } from "@/lib/services/authorizationService";
import {
  updateSecret,
  deleteSecret,
  secretExistsForApplication,
} from "@/lib/services/secretService";
import { auth } from "@/auth";
import { getUserId } from "@/lib/utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const idToken = getUserId(session);

    if (!(await authorize(idToken, "manage_secrets"))) {
      return NextResponse.json<ApiResponse<null>>(
        {
          data: null,
          message: "Unauthorized",
          success: false,
        },
        { status: 403 }
      );
    }

    const body: UpsertSecret = await request.json();
    const secretId = (await params).id;

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

    if (!(await authorize(idToken, "manage_secrets"))) {
      return NextResponse.json<ApiResponse<null>>(
        {
          data: null,
          message: "Unauthorized",
          success: false,
        },
        { status: 403 }
      );
    }

    const secretId = (await params).id;

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
