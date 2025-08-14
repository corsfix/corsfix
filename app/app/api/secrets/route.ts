import { ApiResponse, SecretItem } from "@/types/api";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserId, getKek } from "@/lib/utils";
import {
  manageApplicationSecrets,
  getSecretsForApplication,
} from "@/lib/services/secretService";
import { authorize } from "@/lib/services/authorizationService";
import * as z from "zod";

const ManageSecretsSchema = z.object({
  application_id: z.string().max(32),
  secrets: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().max(64),
      value: z.string().max(255).nullable(),
      delete: z.boolean().optional(),
    })
  ),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const idToken = getUserId(session);

    const json = await request.json();
    const body = ManageSecretsSchema.parse(json);

    // Authorization check for managing secrets
    const newSecretsCount = body.secrets.filter((s) => !s.delete).length;
    const authResult = await authorize(idToken, "manage_secrets", {
      newSecretsCount,
    });

    if (!authResult.allowed) {
      return NextResponse.json<ApiResponse<null>>(
        {
          data: null,
          message: authResult.message || "Not authorized to manage secrets",
          success: false,
        },
        { status: 403 }
      );
    }

    // Validation
    const errors: string[] = [];
    const secretNames = new Set<string>();

    for (const secret of body.secrets) {
      if (!secret.name.trim()) continue; // Skip empty names

      // Check for duplicate names
      if (secretNames.has(secret.name)) {
        errors.push(`Duplicate secret name: ${secret.name}`);
      }
      secretNames.add(secret.name);

      // Check if new secret (no ID) without value
      if (!secret.id && !secret.value?.trim()) {
        errors.push(`New secret "${secret.name}" must have a value`);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json<ApiResponse<null>>(
        {
          data: null,
          message: errors.join(", "),
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

    await manageApplicationSecrets(
      idToken,
      kek,
      body.application_id,
      body.secrets
    );

    // Return updated secrets for this application
    const secrets = await getSecretsForApplication(
      idToken,
      body.application_id
    );

    return NextResponse.json<ApiResponse<SecretItem[]>>({
      data: secrets,
      message: "Secrets managed successfully",
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
