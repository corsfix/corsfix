import { NextResponse } from "next/server";
import { Polar } from "@polar-sh/sdk";
import { getActiveSubscription } from "@/lib/services/subscriptionService";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Failed to generate customer portal (unauthenticated)." },
      { status: 400 }
    );
  }

  const activeSubscription = await getActiveSubscription(session.user.id);

  if (!activeSubscription.customer_id) {
    return NextResponse.json(
      { error: "Failed to generate customer portal (missing customer_id)." },
      { status: 500 }
    );
  }

  try {
    const polar = new Polar({
      accessToken: process.env.POLAR_ACCESS_TOKEN ?? "",
      server: process.env.NODE_ENV === "production" ? "production" : "sandbox",
    });

    const result = await polar.customerSessions.create({
      customerId: activeSubscription.customer_id,
    });

    return NextResponse.redirect(result.customerPortalUrl);
  } catch (error) {
    console.error("Failed to generate customer portal url: " + error);
    return NextResponse.json(
      { error: "Failed to generate customer portal (unknown error occured)" },
      { status: 500 }
    );
  }
}
