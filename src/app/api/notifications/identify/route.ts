import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Knock from "@knocklabs/node";

const knockClient = new Knock({
  apiKey: process.env.KNOCK_API_KEY,
});

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Identify user in Knock
    await knockClient.users.update(user.id, {
      email: user.email,
      name: user.name || user.email,
    });

    return NextResponse.json({ success: true, userId: user.id });
  } catch (error) {
    console.error("Knock identify error:", error);
    return NextResponse.json(
      { error: "Failed to identify user" },
      { status: 500 }
    );
  }
}
