import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import bcrypt from "bcryptjs";
import { DISABLE_SIGNUP } from "@/config/constants";
import { UserV2Entity } from "@/models/UserV2Entity";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, mode } = body;
    const isLogin = mode === "login";

    await dbConnect();
    const user = await UserV2Entity.findOne({ email });

    if (isLogin) {
      if (!user || !user.hash) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }
      const isValidPassword = await bcrypt.compare(password, user.hash);
      if (!isValidPassword) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }
    } else {
      if (user) {
        return NextResponse.json(
          { error: "User already exists" },
          { status: 401 }
        );
      }
      if (DISABLE_SIGNUP) {
        return NextResponse.json(
          { error: "Signups are disabled" },
          { status: 401 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Credentials validation error:", err);
    return NextResponse.json(
      { error: "Failed to authenticate" },
      { status: 500 }
    );
  }
}
