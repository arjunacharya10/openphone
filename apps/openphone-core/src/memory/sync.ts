import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { chunkMarkdown, hashText } from "./chunker.js";
import { createEmbeddingProvider } from "./embeddings.js";
import { getCachedEmbedding, setCachedEmbedding } from "./embedding-cache.js";
import { CONTEXT_DIR, MEMORY_DIR, MEMORY_MD_PATH, USER_MD_PATH } from "./paths.js";
import { EMBEDDING_CACHE_TABLE, FTS_TABLE, ensureMemorySchema, openMemoryDb } from "./schema.js";

const SOURCE = "memory";
const MODEL = "default";
const CHUNK_TOKENS = 400;
const CHUNK_OVERLAP = 80;
const SNIPPET_MAX = 700;

async function listMemoryFiles(): Promise<string[]> {
  const files: string[] = [];
  const add = async (absPath: string) => {
    try {
      const s = await stat(absPath);
      if (s.isFile() && absPath.endsWith(".md")) files.push(absPath);
    } catch {}
  };
  await add(MEMORY_MD_PATH);
  await add(USER_MD_PATH);
  try {
    const entries = await readdir(MEMORY_DIR, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith(".md")) {
        files.push(join(MEMORY_DIR, e.name));
      }
    }
  } catch {}
  return files;
}

function relPath(absPath: string): string {
  return absPath.replace(CONTEXT_DIR, "").replace(/^[/\\]+/, "").replace(/\\/g, "/");
}

export async function syncFiles(reason?: string): Promise<{ filesIndexed: number; chunksIndexed: number }> {
  const db = openMemoryDb();
  ensureMemorySchema(db);
  const provider = createEmbeddingProvider({});
  const providerKey = "default";

  const files = await listMemoryFiles();
  let totalChunks = 0;

  db.exec("BEGIN TRANSACTION");
  try {
    for (const absPath of files) {
      const path = relPath(absPath);
      let content: string;
      try {
        content = await readFile(absPath, "utf-8");
      } catch {
        continue;
      }
      const fileHash = hashText(content);
      const statRes = await stat(absPath);
      const mtime = Math.floor(statRes.mtimeMs / 1000);
      const size = statRes.size;

      const existing = db.prepare("SELECT hash FROM files WHERE path = ?").get(path) as
        | { hash: string }
        | undefined;
      if (existing?.hash === fileHash) continue;

      const chunks = chunkMarkdown(content, { tokens: CHUNK_TOKENS, overlap: CHUNK_OVERLAP });
      if (chunks.length === 0) {
        db.prepare(
          "INSERT OR REPLACE INTO files (path, source, hash, mtime, size) VALUES (?, ?, ?, ?, ?)"
        ).run(path, SOURCE, fileHash, mtime, size);
        continue;
      }

      const oldIds = (db.prepare("SELECT id FROM chunks WHERE path = ?").all(path) as { id: string }[])
        .map((r) => r.id);
      if (oldIds.length > 0) {
        const placeholders = oldIds.map(() => "?").join(", ");
        db.prepare(`DELETE FROM ${FTS_TABLE} WHERE id IN (${placeholders})`).run(...oldIds);
      }
      db.prepare("DELETE FROM chunks WHERE path = ?").run(path);

      const texts = chunks.map((c) => c.text);
      const embeddings: (number[] | undefined)[] = new Array(chunks.length);
      if (provider) {
        const toFetch: { idx: number; hash: string }[] = [];
        for (let i = 0; i < chunks.length; i++) {
          const cached = getCachedEmbedding(db, {
            provider: "openai",
            model: provider.model,
            providerKey,
            hash: chunks[i].hash,
          });
          if (cached) {
            embeddings[i] = cached;
          } else {
            toFetch.push({ idx: i, hash: chunks[i].hash });
          }
        }
        const missingTexts = toFetch.map((t) => texts[t.idx]);
        if (missingTexts.length > 0) {
          const fetched = await provider.embed(missingTexts);
          for (let j = 0; j < toFetch.length; j++) {
            const vec = fetched[j] ?? [];
            embeddings[toFetch[j].idx] = vec;
            setCachedEmbedding(db, {
              provider: "openai",
              model: provider.model,
              providerKey,
              hash: toFetch[j].hash,
              embedding: vec,
              dims: vec.length,
            });
          }
        }
      }
      const now = Math.floor(Date.now() / 1000);
      const insertChunk = db.prepare(
        `INSERT INTO chunks (id, path, source, start_line, end_line, hash, model, text, embedding, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        const id = `${path}:${c.startLine}-${c.endLine}`;
        const emb = embeddings[i];
        const blob = emb?.length ? Buffer.from(new Float32Array(emb).buffer) : null;
        insertChunk.run(
          id,
          path,
          SOURCE,
          c.startLine,
          c.endLine,
          c.hash,
          MODEL,
          c.text,
          blob,
          now
        );
        const snippet = c.text.length > SNIPPET_MAX ? c.text.slice(0, SNIPPET_MAX) + "…" : c.text;
        db.prepare(
          `INSERT INTO ${FTS_TABLE} (text, id, path, source, model, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(snippet, id, path, SOURCE, MODEL, c.startLine, c.endLine);
        totalChunks++;
      }
      db.prepare(
        "INSERT OR REPLACE INTO files (path, source, hash, mtime, size) VALUES (?, ?, ?, ?, ?)"
      ).run(path, SOURCE, fileHash, mtime, size);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  } finally {
    db.close();
  }
  return { filesIndexed: files.length, chunksIndexed: totalChunks };
}
