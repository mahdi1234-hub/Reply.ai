import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOtpEmail, generateOtp } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Create or find user
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { email: normalizedEmail },
      });
    }

    // Invalidate old OTPs
    await prisma.otp.updateMany({
      where: { email: normalizedEmail, used: false },
      data: { used: true },
    });

    // Generate and save new OTP
    const code = generateOtp();
    await prisma.otp.create({
      data: {
        code,
        email: normalizedEmail,
        userId: user.id,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
    });

    // Send OTP email
    await sendOtpEmail(normalizedEmail, code);

    return NextResponse.json({ success: true, message: "OTP sent to your email" });
  } catch (error) {
    console.error("Send OTP error:", error);
    return NextResponse.json(
      { error: "Failed to send OTP. Please try again." },
      { status: 500 }
    );
  }
}
