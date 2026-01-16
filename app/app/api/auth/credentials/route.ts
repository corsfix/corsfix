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

    // Basic input validation for email and password
    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 400 }
      );
    }

    // Simple email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 400 }
      );
    }

    if (password.length === 0) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 400 }
      );
    }

    // Enforce a minimum password length for new signups
    if (!isLogin && password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    await dbConnect();
    const user = await UserV2Entity.findOne({ email: trimmedEmail });

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
          { status: 409 }
        );
      }
      if (DISABLE_SIGNUP) {
        return NextResponse.json(
          { error: "Signups are disabled" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    console.error("Credentials validation error.");
    return NextResponse.json(
      { error: "Failed to validate credentials" },
      { status: 500 }
    );
  }
}
