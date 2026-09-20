import { ApiResponse } from "@/types/api";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  activateTrial,
  TrialActivationError,
} from "@/lib/services/trialService";
import { IS_CLOUD } from "@/config/constants";

export async function POST() {
  const session = await auth();
  const userId = session?.user.id;

  if (!userId || !IS_CLOUD) {
    return NextResponse.json<ApiResponse<null>>(
      { data: null, message: "Unauthorized", success: false },
      { status: 401 }
    );
  }

  try {
    const trialEndsAt = await activateTrial(userId);
    return NextResponse.json<ApiResponse<{ trial_ends_at: Date }>>({
      data: { trial_ends_at: trialEndsAt },
      message: "Trial activated",
      success: true,
    });
  } catch (error) {
    if (error instanceof TrialActivationError) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, message: error.message, success: false },
        { status: 400 }
      );
    }
    console.error("Failed to activate trial", error);
    return NextResponse.json<ApiResponse<null>>(
      { data: null, message: "Failed to activate trial", success: false },
      { status: 500 }
    );
  }
}
