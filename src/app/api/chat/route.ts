import { NextRequest, NextResponse } from "next/server";
import { queryDocuments } from "@/lib/pinecone";

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    // Get the latest user message for RAG query
    const lastUserMessage = [...messages].reverse().find((m: { role: string }) => m.role === "user");
    let documentContext = "";

    if (lastUserMessage && process.env.PINECONE_API_KEY) {
      try {
        const results = await queryDocuments(lastUserMessage.content, 5);
        if (results.length > 0 && results[0].score > 0.01) {
          const contextParts = results
            .filter((r) => r.score > 0.01)
            .map((r) => `[From file: ${r.fileName}]\n${r.text}`);
          if (contextParts.length > 0) {
            documentContext = `\n\nRelevant document context from uploaded files:\n${contextParts.join("\n\n---\n\n")}`;
          }
        }
      } catch (error) {
        console.error("Pinecone query error:", error);
      }
    }

    const systemPrompt = `You are Rep, a helpful AI assistant for Reply.ai. You help users with questions about their customers, deals, leads, and business operations. Be concise, professional, and helpful.

When the user uploads a document or asks about uploaded files, use the provided document context to answer their questions accurately. Reference specific information from the documents when available. If document context is provided, base your answers primarily on that context.${documentContext}`;

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
            content: systemPrompt,
          },
          ...messages,
        ],
        max_tokens: 1024,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Cerebras API error:", errorData);
      return NextResponse.json(
        { error: "Failed to get response from AI" },
        { status: 500 }
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter((line) => line.trim() !== "");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") {
                  controller.enqueue(
                    new TextEncoder().encode("data: [DONE]\n\n")
                  );
                  continue;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(
                      new TextEncoder().encode(
                        `data: ${JSON.stringify({ content })}\n\n`
                      )
                    );
                  }
                } catch {
                  // Skip malformed JSON
                }
              }
            }
          }
        } catch (error) {
          console.error("Stream error:", error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
