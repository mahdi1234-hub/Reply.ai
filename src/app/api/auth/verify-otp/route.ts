import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/auth";
import Knock from "@knocklabs/node";

const knockClient = new Knock({
  apiKey: process.env.KNOCK_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json(
        { error: "Email and OTP are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find valid OTP
    const otpRecord = await prisma.otp.findFirst({
      where: {
        email: normalizedEmail,
        code: otp,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      return NextResponse.json(
        { error: "Invalid or expired OTP" },
        { status: 400 }
      );
    }

    // Mark OTP as used
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    // Mark user as verified
    const user = await prisma.user.update({
      where: { email: normalizedEmail },
      data: { verified: true },
    });

    // Identify user in Knock for notifications
    try {
      await knockClient.users.update(user.id, {
        email: user.email,
        name: user.name || user.email,
      });
    } catch (knockErr) {
      console.error("Knock identify error (non-blocking):", knockErr);
    }

    // Create JWT token
    const token = await createToken(user.id, user.email);

    // Set cookie
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    });

    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { error: "Failed to verify OTP" },
      { status: 500 }
    );
  }
}
