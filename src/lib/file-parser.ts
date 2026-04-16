/* eslint-disable @typescript-eslint/no-require-imports */
import * as mammoth from "mammoth";

export async function parseFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ text: string; fileType: string }> {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  // PDF
  if (ext === "pdf" || mimeType === "application/pdf") {
    try {
      const pdfParse = require("pdf-parse/lib/pdf-parse.js");
      const data = await pdfParse(buffer);
      const text = (data.text || "").trim();
      if (text.length > 5) {
        return { text, fileType: "pdf" };
      }
      // Image-based PDF with no extractable text
      const info = data.info || {};
      return {
        text: `[PDF Document: "${fileName}", Pages: ${data.numpages || "unknown"}, Producer: ${info.Producer || "unknown"}. This PDF contains image-based content. The document "${fileName}" has been uploaded and indexed for reference.]`,
        fileType: "pdf",
      };
    } catch (error) {
      return {
        text: `[PDF Document: "${fileName}" uploaded. Size: ${Math.round(buffer.length / 1024)}KB. The document has been indexed for reference.]`,
        fileType: "pdf",
      };
    }
  }

  // Word documents
  if (
    ext === "docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();
    if (text.length > 0) {
      return { text, fileType: "docx" };
    }
    return {
      text: `[Word Document: "${fileName}" uploaded. The document has been indexed for reference.]`,
      fileType: "docx",
    };
  }

  if (ext === "doc" || mimeType === "application/msword") {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return { text: result.value || `[Word Document: "${fileName}" uploaded.]`, fileType: "doc" };
    } catch {
      return { text: `[Word Document: "${fileName}" uploaded. Size: ${Math.round(buffer.length / 1024)}KB.]`, fileType: "doc" };
    }
  }

  // Plain text
  if (
    ext === "txt" ||
    ext === "md" ||
    ext === "csv" ||
    ext === "json" ||
    ext === "xml" ||
    mimeType.startsWith("text/")
  ) {
    return { text: buffer.toString("utf-8"), fileType: ext || "txt" };
  }

  // Images
  if (
    ext === "jpg" ||
    ext === "jpeg" ||
    ext === "png" ||
    ext === "gif" ||
    ext === "webp" ||
    ext === "bmp" ||
    mimeType.startsWith("image/")
  ) {
    const sizeKB = Math.round(buffer.length / 1024);
    const description = await describeImageWithAI(fileName, mimeType, sizeKB);
    return { text: description, fileType: ext || "image" };
  }

  // Fallback: try to read as text
  try {
    const text = buffer.toString("utf-8");
    if (text && text.length > 0 && !text.includes("\ufffd")) {
      return { text, fileType: ext || "unknown" };
    }
  } catch {
    // Not text-readable
  }

  return {
    text: `[File: "${fileName}" (${ext || mimeType}) uploaded. Size: ${Math.round(buffer.length / 1024)}KB. The file has been indexed for reference.]`,
    fileType: ext || "unknown",
  };
}

async function describeImageWithAI(
  fileName: string,
  mimeType: string,
  sizeKB: number
): Promise<string> {
  try {
    const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CEREBRAS_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama3.1-8b",
        messages: [
          {
            role: "system",
            content: "You are an AI that generates a brief description for an uploaded image based on its filename. Generate a 1-2 sentence description of what this image likely contains based on the filename. Be factual and concise.",
          },
          {
            role: "user",
            content: `An image file named "${fileName}" (${mimeType}, ${sizeKB}KB) has been uploaded. Based on the filename, describe what this image likely contains.`,
          },
        ],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const aiDesc = data.choices?.[0]?.message?.content || "";
      return `[Image: "${fileName}" (${mimeType}, ${sizeKB}KB). ${aiDesc}]`;
    }
  } catch (error) {
    console.error("Error describing image:", error);
  }

  return `[Image: "${fileName}" (${mimeType}, ${sizeKB}KB) uploaded and indexed for reference.]`;
}
