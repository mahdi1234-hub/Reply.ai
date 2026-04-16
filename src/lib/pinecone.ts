import { Pinecone } from "@pinecone-database/pinecone";
import { generateEmbedding } from "./embeddings";

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "",
});

const INDEX_NAME = "rag-knowledge-base";

export interface DocumentChunk {
  id: string;
  text: string;
  metadata: {
    fileName: string;
    fileType: string;
    chunkIndex: number;
    totalChunks: number;
    uploadedAt: string;
  };
}

function chunkText(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
  const chunks: string[] = [];
  const words = text.split(/\s+/);

  if (words.length <= chunkSize) {
    return [text];
  }

  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    const chunk = words.slice(start, end).join(" ");
    if (chunk.trim()) {
      chunks.push(chunk.trim());
    }
    start = end - overlap;
    if (start >= words.length - overlap) break;
  }

  return chunks.length > 0 ? chunks : [text];
}

export async function indexDocument(
  text: string,
  fileName: string,
  fileType: string
): Promise<{ chunksIndexed: number }> {
  const index = pinecone.index(INDEX_NAME);
  const chunks = chunkText(text);
  const timestamp = new Date().toISOString();
  const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const vectors = chunks.map((chunk, i) => ({
    id: `${docId}_chunk_${i}`,
    values: generateEmbedding(chunk),
    metadata: {
      fileName,
      fileType,
      chunkIndex: i,
      totalChunks: chunks.length,
      uploadedAt: timestamp,
      text: chunk.substring(0, 3500), // Pinecone metadata limit
    },
  }));

  // Upsert in batches of 100
  for (let i = 0; i < vectors.length; i += 100) {
    const batch = vectors.slice(i, i + 100);
    await index.upsert({ records: batch });
  }

  return { chunksIndexed: chunks.length };
}

export async function queryDocuments(
  query: string,
  topK: number = 5
): Promise<{ text: string; fileName: string; score: number }[]> {
  const index = pinecone.index(INDEX_NAME);
  const queryEmbedding = generateEmbedding(query);

  const results = await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
  });

  type MatchResult = {
    metadata?: Record<string, unknown>;
    score?: number;
  };

  return (
    (results.matches as MatchResult[] | undefined)?.map((match) => ({
      text: (match.metadata?.text as string) || "",
      fileName: (match.metadata?.fileName as string) || "",
      score: match.score || 0,
    })) || []
  );
}
