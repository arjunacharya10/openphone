import { createHash } from "node:crypto";

export interface MemoryChunk {
  startLine: number;
  endLine: number;
  text: string;
  hash: string;
}

export function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Line-based markdown chunker with overlap. Adapted from OpenClaw internal.ts.
 * Defaults: 400 tokens (~1600 chars), 80 overlap (~320 chars).
 */
export function chunkMarkdown(
  content: string,
  chunking: { tokens?: number; overlap?: number } = {}
): MemoryChunk[] {
  const tokens = chunking.tokens ?? 400;
  const overlap = chunking.overlap ?? 80;
  const lines = content.split("\n");
  if (lines.length === 0) return [];

  const maxChars = Math.max(32, tokens * 4);
  const overlapChars = Math.max(0, overlap * 4);
  const chunks: MemoryChunk[] = [];

  let current: Array<{ line: string; lineNo: number }> = [];
  let currentChars = 0;

  const flush = (): void => {
    if (current.length === 0) return;
    const firstEntry = current[0];
    const lastEntry = current[current.length - 1];
    if (!firstEntry || !lastEntry) return;
    const text = current.map((e) => e.line).join("\n");
    chunks.push({
      startLine: firstEntry.lineNo,
      endLine: lastEntry.lineNo,
      text,
      hash: hashText(text),
    });
  };

  const carryOverlap = (): void => {
    if (overlapChars <= 0 || current.length === 0) {
      current = [];
      currentChars = 0;
      return;
    }
    let acc = 0;
    const kept: Array<{ line: string; lineNo: number }> = [];
    for (let i = current.length - 1; i >= 0; i -= 1) {
      const entry = current[i];
      if (!entry) continue;
      acc += entry.line.length + 1;
      kept.unshift(entry);
      if (acc >= overlapChars) break;
    }
    current = kept;
    currentChars = kept.reduce((sum, e) => sum + e.line.length + 1, 0);
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const lineNo = i + 1;
    const segments: string[] =
      line.length === 0 ? [""] : [];
    if (line.length > 0) {
      for (let start = 0; start < line.length; start += maxChars) {
        segments.push(line.slice(start, start + maxChars));
      }
    }
    for (const segment of segments) {
      const lineSize = segment.length + 1;
      if (currentChars + lineSize > maxChars && current.length > 0) {
        flush();
        carryOverlap();
      }
      current.push({ line: segment, lineNo });
      currentChars += lineSize;
    }
  }
  flush();
  return chunks;
}
