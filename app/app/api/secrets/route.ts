import { ApiResponse, SecretItem, UpsertSecret } from "@/types/api";
import { NextRequest, NextResponse } from "next/server";
import { getKek } from "@/lib/utils";
import { authorize } from "@/lib/services/authorizationService";
import {
  createSecret,
  secretExistsForApplication,
} from "@/lib/services/secretService";
import { auth } from "@/auth";
import { getUserId } from "@/lib/utils";

export async function POST(request: NextRequest) {
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

    // Check if a secret with the same name already exists for this application
    const secretExists = await secretExistsForApplication(
      idToken,
      body.application_id,
      body.name
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

    // Create secret using the secretService
    const secret = await createSecret(idToken, kek, body);

    return NextResponse.json<ApiResponse<SecretItem>>({
      data: secret,
      message: "success",
      success: true,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
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
