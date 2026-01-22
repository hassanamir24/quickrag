export function estimateTokens(text: string): number {
  const chars = text.length;
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  
  if (words === 0) return 0;
  
  const avgCharsPerWord = chars / words;
  const avgTokensPerWord = avgCharsPerWord > 5 ? 1.3 : 1.0;
  
  return Math.ceil(words * avgTokensPerWord);
}

export function estimateTokensBatch(texts: string[]): number {
  return texts.reduce((sum, text) => sum + estimateTokens(text), 0);
}
