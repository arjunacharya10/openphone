import type Database from "better-sqlite3";
import { EMBEDDING_CACHE_TABLE } from "./schema.js";
import { bytesToVec } from "./vector.js";

const DEFAULT_MAX_ENTRIES = 10_000;

export function getCachedEmbedding(
  db: Database.Database,
  params: {
    provider: string;
    model: string;
    providerKey: string;
    hash: string;
  }
): number[] | null {
  const row = db
    .prepare(
      `SELECT embedding, dims FROM ${EMBEDDING_CACHE_TABLE}
       WHERE provider = ? AND model = ? AND provider_key = ? AND hash = ?`
    )
    .get(params.provider, params.model, params.providerKey, params.hash) as
    | { embedding: Buffer; dims: number }
    | undefined;
  if (!row?.embedding) return null;
  const buf = row.embedding as Buffer;
  return bytesToVec(new Uint8Array(buf));
}

export function setCachedEmbedding(
  db: Database.Database,
  params: {
    provider: string;
    model: string;
    providerKey: string;
    hash: string;
    embedding: number[];
    dims: number;
    maxEntries?: number;
  }
): void {
  const now = Math.floor(Date.now() / 1000);
  const blob = Buffer.from(new Float32Array(params.embedding).buffer);

  db.prepare(
    `INSERT OR REPLACE INTO ${EMBEDDING_CACHE_TABLE}
     (provider, model, provider_key, hash, embedding, dims, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    params.provider,
    params.model,
    params.providerKey,
    params.hash,
    blob,
    params.dims,
    now
  );

  const maxEntries = params.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const count = db.prepare(`SELECT COUNT(*) as c FROM ${EMBEDDING_CACHE_TABLE}`).get() as {
    c: number;
  };
  if (count.c > maxEntries) {
    const toDelete = count.c - maxEntries;
    db.prepare(
      `DELETE FROM ${EMBEDDING_CACHE_TABLE} WHERE rowid IN (
        SELECT rowid FROM ${EMBEDDING_CACHE_TABLE} ORDER BY updated_at ASC LIMIT ?
      )`
    ).run(toDelete);
  }
}
