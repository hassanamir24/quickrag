import type { EmbeddingProvider } from "./base.js";

export class VoyageAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private model: string;
  private dimensions: number;
  private baseUrl: string;
  private dimensionsInitialized: boolean = false;

  constructor(apiKey: string, model: string = "voyage-3", dimensions?: number) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = "https://api.voyageai.com/v1";
    
    // If dimensions provided, use them; otherwise infer from model name
    if (dimensions !== undefined) {
      this.dimensions = dimensions;
      this.dimensionsInitialized = true;
    } else {
      // voyage-3, voyage-3-lite: 1024 dimensions
      // voyage-large-2, voyage-2: 1536 dimensions
      // Default to 1024 if uncertain
      this.dimensions = model.includes("large") || model.includes("voyage-2") ? 1536 : 1024;
    }
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    });

    if (!response.ok) {
      let errorMessage: string;
      try {
        const errorData = await response.json() as { error?: { message?: string } };
        errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      } catch {
        errorMessage = await response.text() || `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(`VoyageAI API error: ${errorMessage}`);
    }

    const data = await response.json() as { data?: Array<{ embedding?: number[] }> };
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      throw new Error("Invalid response from VoyageAI API: missing or empty data array");
    }
    
    const embedding = data.data[0].embedding;
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error("Invalid response from VoyageAI API: missing or invalid embedding");
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
    
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });

    if (!response.ok) {
      let errorMessage: string;
      try {
        const errorData = await response.json() as { error?: { message?: string } };
        errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      } catch {
        errorMessage = await response.text() || `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(`VoyageAI API error: ${errorMessage}`);
    }

    const data = await response.json() as { data?: Array<{ embedding?: number[] }> };
    if (!data.data || !Array.isArray(data.data) || data.data.length !== texts.length) {
      throw new Error(
        `Invalid response from VoyageAI API: expected ${texts.length} embeddings, got ${data.data?.length ?? 0}`
      );
    }
    
    const embeddings = data.data.map((item, index) => {
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
