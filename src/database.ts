import * as lancedb from "@lancedb/lancedb";
import type { DocumentChunk } from "./parser.js";
import type { EmbeddingProvider } from "./embeddings/base.js";

export interface IndexedChunk {
  id: string;
  text: string;
  filePath: string;
  startLine: number;
  endLine: number;
  startChar: number;
  endChar: number;
  vector: number[];
}

export class RAGDatabase {
  private dbPath: string;
  private table: lancedb.Table | null = null;
  private dimensions: number;
  private db: Awaited<ReturnType<typeof lancedb.connect>> | null = null;

  constructor(dbPath: string, dimensions: number) {
    this.dbPath = dbPath;
    this.dimensions = dimensions;
  }

  async initialize(): Promise<void> {
    this.db = await lancedb.connect(this.dbPath);
    
    // Check if table exists
    try {
      this.table = await this.db.openTable("documents");
    } catch {
      // Table doesn't exist, will be created in indexChunks with first batch
      this.table = null;
    }
  }

  async indexChunks(
    chunks: DocumentChunk[],
    embeddingProvider: EmbeddingProvider
  ): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    if (chunks.length === 0) {
      console.log("No chunks to index.");
      return;
    }

    console.log(`Indexing ${chunks.length} chunks...`);
    
    // Generate embeddings in batches
    const batchSize = 100;
    const indexedChunks: IndexedChunk[] = [];
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map((chunk) => chunk.text);
      
      console.log(`Embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}...`);
      const embeddings = await embeddingProvider.embedBatch(texts);
      
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const id = `${chunk.filePath}:${chunk.startLine}:${chunk.endLine}`;
        indexedChunks.push({
          id,
          text: chunk.text,
          filePath: chunk.filePath,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          startChar: chunk.startChar,
          endChar: chunk.endChar,
          vector: embeddings[j],
        });
      }
    }
    
    // Create table if it doesn't exist, or add to existing table
    if (!this.table) {
      console.log("Creating new table with first batch...");
      // LanceDB accepts arrays of objects - ensure proper structure
      const tableData = indexedChunks.map(chunk => ({
        id: chunk.id,
        text: chunk.text,
        filePath: chunk.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        startChar: chunk.startChar,
        endChar: chunk.endChar,
        vector: chunk.vector,
      }));
      this.table = await this.db.createTable("documents", tableData);
    } else {
      console.log("Inserting into database...");
      const tableData = indexedChunks.map(chunk => ({
        id: chunk.id,
        text: chunk.text,
        filePath: chunk.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        startChar: chunk.startChar,
        endChar: chunk.endChar,
        vector: chunk.vector,
      }));
      await this.table.add(tableData);
    }
    
    console.log(`Successfully indexed ${indexedChunks.length} chunks.`);
  }

  async search(
    queryVector: number[],
    topK: number = 5
  ): Promise<IndexedChunk[]> {
    if (!this.db) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    if (!this.table) {
      throw new Error("Table 'documents' does not exist. Please index documents first.");
    }
    if (queryVector.length !== this.dimensions) {
      throw new Error(
        `Query vector dimension mismatch: expected ${this.dimensions}, got ${queryVector.length}`
      );
    }

    const results = await this.table
      .vectorSearch(queryVector)
      .limit(topK)
      .toArray();

    return results.map((result: Record<string, unknown>) => ({
      id: String(result.id ?? ""),
      text: String(result.text ?? ""),
      filePath: String(result.filePath ?? ""),
      startLine: Number(result.startLine ?? 0),
      endLine: Number(result.endLine ?? 0),
      startChar: Number(result.startChar ?? 0),
      endChar: Number(result.endChar ?? 0),
      vector: Array.isArray(result.vector) ? result.vector as number[] : [],
    }));
  }

  async getStats(): Promise<{ count: number }> {
    if (!this.table) {
      throw new Error("Database not initialized. Call initialize() first.");
    }

    const count = await this.table.countRows();
    return { count };
  }
}
