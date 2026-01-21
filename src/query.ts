import { RAGDatabase } from "./database.js";
import type { EmbeddingProvider } from "./embeddings/base.js";
import type { IndexedChunk } from "./database.js";

export async function queryDatabase(
  dbPath: string,
  query: string,
  embeddingProvider: EmbeddingProvider,
  topK: number = 5
): Promise<IndexedChunk[]> {
  // Initialize with a placeholder dimension - will be detected from existing database
  const db = new RAGDatabase(dbPath, embeddingProvider.getDimensions());
  await db.initialize();
  
  // Get the actual dimensions from the database (may differ from provider if table exists)
  const dbDimensions = db.getDimensions();
  
  // Generate query vector
  const queryVector = await embeddingProvider.embed(query);
  
  // Validate that the embedding provider produces vectors matching the database
  if (queryVector.length !== dbDimensions) {
    throw new Error(
      `Embedding dimension mismatch: database expects ${dbDimensions} dimensions, ` +
      `but the embedding provider (${embeddingProvider.constructor.name}) produces ${queryVector.length} dimensions. ` +
      `Please use the same embedding model that was used for indexing.`
    );
  }
  
  const results = await db.search(queryVector, topK);
  
  return results;
}

export function formatResults(results: IndexedChunk[]): string {
  let output = `Found ${results.length} results:\n\n`;
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const lineRange = result.startLine === result.endLine 
      ? `line ${result.startLine}`
      : `lines ${result.startLine}-${result.endLine}`;
    output += `[${i + 1}] ${result.filePath} (${lineRange})\n`;
    output += `${"=".repeat(60)}\n`;
    output += `${result.text}\n\n`;
  }
  
  return output;
}
