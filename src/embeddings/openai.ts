import OpenAI from "openai";
import type { EmbeddingProvider } from "./base.js";

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private client: OpenAI;
  private model: string;
  private dimensions: number;
  private dimensionsInitialized: boolean = false;

  constructor(apiKey: string, model: string = "text-embedding-3-small", dimensions?: number) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    
    // If dimensions provided, use them; otherwise infer from model name
    if (dimensions !== undefined) {
      this.dimensions = dimensions;
      this.dimensionsInitialized = true;
    } else {
      // text-embedding-3-small: 1536 dimensions (default)
      // text-embedding-3-large: 3072 dimensions
      // text-embedding-ada-002: 1536 dimensions
      // Note: text-embedding-3-* models support custom dimensions, but we use defaults
      this.dimensions = model.includes("large") ? 3072 : 1536;
    }
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });
    
    if (!response.data || response.data.length === 0) {
      throw new Error("Invalid response from OpenAI API: missing or empty data array");
    }
    
    const embedding = response.data[0].embedding;
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error("Invalid response from OpenAI API: missing or invalid embedding");
    }
    
    // Validate dimensions on first call
    if (!this.dimensionsInitialized) {
      this.dimensions = embedding.length;
      this.dimensionsInitialized = true;
    } else if (embedding.length !== this.dimensions) {
      throw new Error(
        `Embedding dimension mismatch: expected ${this.dimensions}, got ${embedding.length}. ` +
        `This may indicate a model change. Please restart with the correct dimensions.`
      );
    }
    
    return embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });
    
    if (!response.data || response.data.length !== texts.length) {
      throw new Error(
        `Invalid response from OpenAI API: expected ${texts.length} embeddings, got ${response.data?.length ?? 0}`
      );
    }
    
    const embeddings = response.data.map((item, index) => {
      if (!item.embedding || !Array.isArray(item.embedding)) {
        throw new Error(`Invalid embedding at index ${index}`);
      }
      
      // Validate dimensions
      if (this.dimensionsInitialized && item.embedding.length !== this.dimensions) {
        throw new Error(
          `Embedding dimension mismatch at index ${index}: expected ${this.dimensions}, got ${item.embedding.length}`
        );
      } else if (!this.dimensionsInitialized) {
        this.dimensions = item.embedding.length;
        this.dimensionsInitialized = true;
      }
      
      return item.embedding;
    });
    
    return embeddings;
  }

  getDimensions(): number {
    return this.dimensions;
  }
}
