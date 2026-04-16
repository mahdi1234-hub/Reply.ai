import { NextRequest, NextResponse } from "next/server";
import { parseFile } from "@/lib/file-parser";
import { indexDocument } from "@/lib/pinecone";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;
    const mimeType = file.type;

    // Parse the file content
    const { text, fileType } = await parseFile(buffer, fileName, mimeType);

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from file" },
        { status: 400 }
      );
    }

    // Index in Pinecone
    const { chunksIndexed } = await indexDocument(text, fileName, fileType);

    return NextResponse.json({
      success: true,
      fileName,
      fileType,
      textLength: text.length,
      chunksIndexed,
      preview: text.substring(0, 200) + (text.length > 200 ? "..." : ""),
    });
  } catch (error) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
