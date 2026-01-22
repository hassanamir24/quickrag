export interface DocumentChunk {
  text: string;
  filePath: string;
  startLine: number;
  endLine: number;
  startChar: number;
  endChar: number;
}

export interface ChunkerOptions {
  chunkSize: number;
  chunkOverlap: number;
  minChunkSize?: number;
}

export interface Chunker {
  chunk(text: string, filePath: string, options: ChunkerOptions): DocumentChunk[];
}
