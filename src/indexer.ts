import { parseDirectory, type ChunkingOptions } from "./parser.js";
import { RAGDatabase } from "./database.js";
import type { EmbeddingProvider } from "./embeddings/base.js";

export async function indexDirectory(
  dirPath: string,
  dbPath: string,
  embeddingProvider: EmbeddingProvider,
  chunkingOptions: ChunkingOptions
): Promise<void> {
  console.log(`Parsing documents from ${dirPath}...`);
  const chunks = await parseDirectory(dirPath, chunkingOptions);
  
  if (chunks.length === 0) {
    console.log("No documents found to index.");
    return;
  }
  
  console.log(`Found ${chunks.length} chunks from ${dirPath}`);
  
  // Initialize embedding provider dimensions by generating a test embedding
  // This ensures we get the correct dimensions before creating the database
  const testEmbedding = await embeddingProvider.embed(chunks[0].text);
  const dimensions = testEmbedding.length;
  console.log(`Detected embedding dimensions: ${dimensions}`);
  
  const db = new RAGDatabase(dbPath, dimensions);
  await db.initialize();
  await db.indexChunks(chunks, embeddingProvider);
  
  const stats = await db.getStats();
  console.log(`\nIndexing complete! Total chunks in database: ${stats.count}`);
}
