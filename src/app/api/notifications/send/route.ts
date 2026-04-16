import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import Knock from "@knocklabs/node";

const knockClient = new Knock({
  apiKey: process.env.KNOCK_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recipientIds, message } = await req.json();

    if (!recipientIds || !Array.isArray(recipientIds) || !message) {
      return NextResponse.json(
        { error: "recipientIds (array) and message are required" },
        { status: 400 }
      );
    }

    // Trigger the workflow for each recipient
    const result = await knockClient.workflows.trigger("test_mode", {
      recipients: recipientIds,
      data: {
        message,
      },
      actor: session.userId,
    });

    return NextResponse.json({
      success: true,
      workflowRunId: result.workflow_run_id,
    });
  } catch (error) {
    console.error("Knock send notification error:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
