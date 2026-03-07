/**
 * Vector utilities for memory search. Ported from ZeroClaw vector.rs.
 */

export function vecToBytes(v: number[]): Float32Array {
  const arr = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) arr[i] = v[i];
  return arr;
}

export function bytesToVec(bytes: Uint8Array | Buffer): number[] {
  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength
  );
  const len = Math.floor(bytes.length / 4);
  const out: number[] = [];
  for (let i = 0; i < len; i++) {
    out.push(view.getFloat32(i * 4, true));
  }
  return out;
}

/** Cosine similarity between two vectors. Returns 0–1. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (!Number.isFinite(denom) || denom < 1e-15) return 0;
  const raw = dot / denom;
  return !Number.isFinite(raw) ? 0 : Math.max(0, Math.min(1, raw));
}
