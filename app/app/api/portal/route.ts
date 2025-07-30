import { NextResponse } from "next/server";
import { Polar } from "@polar-sh/sdk";
import { getActiveSubscription } from "@/lib/services/subscriptionService";
import { auth } from "@/auth";
import { getUserId } from "@/lib/utils";

export async function GET() {
  const session = await auth();
  const idToken = getUserId(session);

  const activeSubscription = await getActiveSubscription(idToken);

  const polar = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN ?? "",
    server: process.env.NODE_ENV === "production" ? "production" : "sandbox",
  });

  try {
    const result = await polar.customerSessions.create({
      customerId: activeSubscription.customer_id,
    });

    return NextResponse.redirect(result.customerPortalUrl);
  } catch (error) {
    console.error("Failed to generate customer portal url: " + error);
    return NextResponse.json(
      { error: "Failed to generate customer portal" },
      { status: 500 }
    );
  }
}
