// Simple text embedding using a basic hashing approach for 384 dimensions
// This creates consistent embeddings without needing an external embedding API

export function generateEmbedding(text: string): number[] {
  const dimension = 384;
  const embedding = new Array(dimension).fill(0);

  // Normalize text
  const normalizedText = text.toLowerCase().trim();

  // Create a deterministic embedding using character-level hashing
  for (let i = 0; i < normalizedText.length; i++) {
    const charCode = normalizedText.charCodeAt(i);
    const idx = (charCode * (i + 1) * 31) % dimension;
    embedding[idx] += 1.0;

    // Add bigram features
    if (i < normalizedText.length - 1) {
      const nextCharCode = normalizedText.charCodeAt(i + 1);
      const bigramIdx = ((charCode * 17 + nextCharCode * 13) * (i + 1)) % dimension;
      embedding[bigramIdx] += 0.5;
    }

    // Add trigram features
    if (i < normalizedText.length - 2) {
      const c2 = normalizedText.charCodeAt(i + 1);
      const c3 = normalizedText.charCodeAt(i + 2);
      const trigramIdx = ((charCode * 7 + c2 * 11 + c3 * 23) * (i + 1)) % dimension;
      embedding[trigramIdx] += 0.3;
    }
  }

  // Word-level features
  const words = normalizedText.split(/\s+/);
  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) & 0xffffffff;
    }
    const wordIdx = Math.abs(hash) % dimension;
    embedding[wordIdx] += 2.0;
  }

  // L2 normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < dimension; i++) {
      embedding[i] = embedding[i] / magnitude;
    }
  }

  return embedding;
}
