import type Database from "better-sqlite3";
import { createEmbeddingProvider } from "./embeddings.js";
import { FTS_TABLE, ensureMemorySchema, openMemoryDb } from "./schema.js";
import { bytesToVec, cosineSimilarity } from "./vector.js";

export interface MemorySearchResult {
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
}

const SNIPPET_MAX = 700;
const DEFAULT_MAX_RESULTS = 6;
const DEFAULT_MIN_SCORE = 0.35;
const DEFAULT_VECTOR_WEIGHT = 0.7;
const DEFAULT_KEYWORD_WEIGHT = 0.3;
const MODEL = "default";
const SOURCE_FILTER = " AND source = 'memory'";

function buildFtsQuery(raw: string): string | null {
  const tokens =
    raw
      .match(/[\p{L}\p{N}_]+/gu)
      ?.map((t) => t.trim())
      .filter(Boolean) ?? [];
  if (tokens.length === 0) return null;
  const quoted = tokens.map((t) => `"${String(t).replaceAll('"', "")}"`);
  return quoted.join(" AND ");
}

function bm25RankToScore(rank: number): number {
  const normalized = Number.isFinite(rank) ? Math.max(0, rank) : 999;
  return 1 / (1 + normalized);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

function hybridMerge(
  vectorResults: Array<{ id: string; path: string; startLine: number; endLine: number; snippet: string; score: number }>,
  keywordResults: Array<{ id: string; path: string; startLine: number; endLine: number; snippet: string; score: number }>,
  vectorWeight: number,
  keywordWeight: number,
  limit: number
): MemorySearchResult[] {
  const byId = new Map<
    string,
    { path: string; startLine: number; endLine: number; snippet: string; vectorScore: number; keywordScore: number }
  >();
  for (const r of vectorResults) {
    byId.set(r.id, {
      path: r.path,
      startLine: r.startLine,
      endLine: r.endLine,
      snippet: r.snippet,
      vectorScore: r.score,
      keywordScore: 0,
    });
  }
  const maxKw = keywordResults.length > 0
    ? Math.max(...keywordResults.map((r) => r.score), 1e-10)
    : 1;
  for (const r of keywordResults) {
    const normalized = r.score / maxKw;
    const existing = byId.get(r.id);
    if (existing) {
      existing.keywordScore = Math.max(existing.keywordScore, normalized);
    } else {
      byId.set(r.id, {
        path: r.path,
        startLine: r.startLine,
        endLine: r.endLine,
        snippet: r.snippet,
        vectorScore: 0,
        keywordScore: normalized,
      });
    }
  }
  return Array.from(byId.entries())
    .map(([_, v]) => ({
      ...v,
      score: vectorWeight * v.vectorScore + keywordWeight * v.keywordScore,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ path, startLine, endLine, snippet, score }) => ({
      path,
      startLine,
      endLine,
      score,
      snippet,
    }));
}

export async function search(
  query: string,
  opts?: {
    maxResults?: number;
    minScore?: number;
    vectorWeight?: number;
    keywordWeight?: number;
  }
): Promise<MemorySearchResult[]> {
  const maxResults = opts?.maxResults ?? DEFAULT_MAX_RESULTS;
  const minScore = opts?.minScore ?? DEFAULT_MIN_SCORE;
  const vectorWeight = opts?.vectorWeight ?? DEFAULT_VECTOR_WEIGHT;
  const keywordWeight = opts?.keywordWeight ?? DEFAULT_KEYWORD_WEIGHT;
  const limit = Math.max(maxResults * 2, 20);

  const db = openMemoryDb();
  ensureMemorySchema(db);
  const provider = createEmbeddingProvider({});

  const sourceFilter = { sql: SOURCE_FILTER, params: [] as unknown[] };

  let vectorResults: Array<{
    id: string;
    path: string;
    startLine: number;
    endLine: number;
    snippet: string;
    score: number;
  }> = [];

  if (provider) {
    const queryVec = (await provider.embed([query]))[0];
    if (queryVec?.length) {
      const rows = db
        .prepare(
          `SELECT id, path, start_line, end_line, text, embedding FROM chunks
           WHERE model = ? AND embedding IS NOT NULL ${sourceFilter.sql}`
        )
        .all(MODEL, ...sourceFilter.params) as Array<{
        id: string;
        path: string;
        start_line: number;
        end_line: number;
        text: string;
        embedding: Buffer;
      }>;
      const candidates = rows
        .map((row) => {
          const vec = bytesToVec(new Uint8Array(row.embedding as Buffer));
          const score = cosineSimilarity(queryVec, vec);
          return { row, score };
        })
        .filter((c) => Number.isFinite(c.score))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      vectorResults = candidates.map((c) => ({
        id: c.row.id,
        path: c.row.path,
        startLine: c.row.start_line,
        endLine: c.row.end_line,
        snippet: truncate(c.row.text, SNIPPET_MAX),
        score: c.score,
      }));
    }
  }

  let keywordResults: Array<{
    id: string;
    path: string;
    startLine: number;
    endLine: number;
    snippet: string;
    score: number;
  }> = [];
  const ftsQuery = buildFtsQuery(query);
  if (ftsQuery) {
    try {
      const rows = db
        .prepare(
          `SELECT id, path, start_line, end_line, text, bm25(${FTS_TABLE}) AS rank
           FROM ${FTS_TABLE}
           WHERE ${FTS_TABLE} MATCH ? ${sourceFilter.sql}
           ORDER BY rank ASC LIMIT ?`
        )
        .all(ftsQuery, ...sourceFilter.params, limit) as Array<{
        id: string;
        path: string;
        start_line: number;
        end_line: number;
        text: string;
        rank: number;
      }>;
      keywordResults = rows.map((r) => ({
        id: r.id,
        path: r.path,
        startLine: r.start_line,
        endLine: r.end_line,
        snippet: truncate(r.text, SNIPPET_MAX),
        score: bm25RankToScore(r.rank),
      }));
    } catch {
      keywordResults = [];
    }
  }

  db.close();

  const merged = hybridMerge(
    vectorResults,
    keywordResults,
    vectorWeight,
    keywordWeight,
    maxResults
  );
  return merged.filter((r) => r.score >= minScore);
}
