import { parseDirectory, type ChunkerOptions, type FileInfo, chunkText, type DocumentChunk } from "./parser.js";
import { RAGDatabase } from "./database.js";
import type { EmbeddingProvider } from "./embeddings/base.js";
import type { QuickRAGConfig } from "./config.js";
import { createChunker, type ChunkerType } from "./chunkers/index.js";
import { readFile } from "fs/promises";
import { logger } from "./utils/logger.js";
import cliProgress from "cli-progress";
import ora from "ora";

export async function indexDirectory(
  dirPath: string,
  dbPath: string,
  embeddingProvider: EmbeddingProvider,
  chunkingOptions: ChunkerOptions,
  clear: boolean = false,
  config?: QuickRAGConfig
): Promise<void> {
  const chunkerType: ChunkerType = config?.chunking?.strategy || "recursive-token";
  logger.info(`Parsing documents from ${dirPath}... (using ${chunkerType} chunker)`);
  const { chunks: allChunks, files } = await parseDirectory(dirPath, chunkingOptions, chunkerType);
  
  if (files.length === 0) {
    logger.warn("No documents found to index.");
    return;
  }
  
  const spinner = ora("Detecting embedding dimensions...").start();
  let dimensions: number;
  if (allChunks.length > 0) {
    const testEmbedding = await embeddingProvider.embed(allChunks[0].text);
    dimensions = testEmbedding.length;
  } else {
    const testEmbedding = await embeddingProvider.embed("test");
    dimensions = testEmbedding.length;
  }
  spinner.succeed(`Detected embedding dimensions: ${dimensions}`);
  
  const db = new RAGDatabase(dbPath, dimensions, config);
  await db.initialize();
  
  if (clear) {
    const clearSpinner = ora("Clearing existing index...").start();
    await db.clearDatabase();
    await db.initialize();
    clearSpinner.succeed("Cleared existing index");
  }
  
  const indexedFiles = await db.getIndexedFiles();
  const filesToIndex: FileInfo[] = [];
  
  for (const file of files) {
    if (clear || !indexedFiles.has(file.path) || !(await db.isFileIndexed(file.path, file.mtime))) {
      filesToIndex.push(file);
    }
  }
  
  if (filesToIndex.length === 0) {
    logger.success("All files are already indexed and up to date.");
    const stats = await db.getStats();
    logger.info(`Total chunks in database: ${stats.count}`);
    return;
  }
  
  logger.info(`Found ${filesToIndex.length} file(s) to index (${files.length - filesToIndex.length} already indexed)`);
  
  const allChunksToIndex: Array<{ chunk: DocumentChunk; filePath: string; mtime: number }> = [];
  
  const fileProgressBar = new cliProgress.SingleBar({
    format: "Collecting chunks |{bar}| {percentage}% | {value}/{total} files | {file}",
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  }, cliProgress.Presets.shades_classic);
  
  fileProgressBar.start(filesToIndex.length, 0, { file: "" });
  
  for (let i = 0; i < filesToIndex.length; i++) {
    const file = filesToIndex[i];
    fileProgressBar.update(i, { file: file.path });
    
    try {
      if (!clear) {
        await db.removeFileFromIndex(file.path);
      }
      
      let content: string;
      try {
        content = await readFile(file.path, "utf-8");
      } catch (readError) {
        logger.warn(`Could not read ${file.path} as UTF-8, trying with error handling...`);
        const buffer = await readFile(file.path);
        const decoder = new TextDecoder("utf-8", { fatal: false });
        content = decoder.decode(buffer);
      }
      
      const chunker = createChunker(chunkerType);
      const fileChunks = chunkText(content, file.path, chunkingOptions, chunker);
      
      for (const chunk of fileChunks) {
        allChunksToIndex.push({ chunk, filePath: file.path, mtime: file.mtime });
      }
    } catch (error) {
      logger.error(`Error reading ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  fileProgressBar.update(filesToIndex.length, { file: "Complete" });
  fileProgressBar.stop();
  
  if (allChunksToIndex.length === 0) {
    logger.warn("No chunks to index.");
    return;
  }
  
  logger.info(`Collected ${allChunksToIndex.length} chunks across ${filesToIndex.length} files`);
  
  let statsBefore = { count: 0 };
  try {
    statsBefore = await db.getStats();
  } catch {
    // Table might not exist yet, that's okay
  }
  
  const chunksToIndex = allChunksToIndex.map(item => item.chunk);
  await db.indexChunks(chunksToIndex, embeddingProvider);
  
  let statsAfter = { count: 0 };
  try {
    statsAfter = await db.getStats();
  } catch {
    // Table might not exist, that's okay
  }
  
  const totalNewChunks = statsAfter.count - statsBefore.count;
  
  for (const file of filesToIndex) {
    try {
      await db.markFileIndexed(file.path, file.mtime);
    } catch (error) {
      logger.warn(`Could not mark ${file.path} as indexed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  const totalChunks = allChunksToIndex.length;
  const skippedChunks = totalChunks - totalNewChunks;
  
  let stats = { count: 0 };
  try {
    stats = await db.getStats();
  } catch {
    // Table might not exist, that's okay
  }
  
  logger.success(`Indexing complete! Processed ${totalChunks} chunks across ${filesToIndex.length} files`);
  logger.info(`Added ${totalNewChunks} new chunks (${skippedChunks} already existed). Total chunks in database: ${stats.count}`);
}
