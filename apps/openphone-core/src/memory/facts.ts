import { openMemoryDb, ensureMemorySchema } from "./schema.js";

export interface Fact {
  key: string;
  value: string;
  source: string;
  updated_at: number;
}

export function setFact(key: string, value: string, source = "agent"): void {
  const db = openMemoryDb();
  ensureMemorySchema(db);
  db.prepare(
    "INSERT OR REPLACE INTO facts (key, value, source, updated_at) VALUES (?, ?, ?, ?)"
  ).run(key.trim(), value.trim(), source, Math.floor(Date.now() / 1000));
  db.close();
}

export function deleteFact(key: string): void {
  const db = openMemoryDb();
  ensureMemorySchema(db);
  db.prepare("DELETE FROM facts WHERE key = ?").run(key.trim());
  db.close();
}

export function getFacts(): Fact[] {
  const db = openMemoryDb();
  ensureMemorySchema(db);
  const rows = db
    .prepare("SELECT key, value, source, updated_at FROM facts ORDER BY key ASC")
    .all() as Fact[];
  db.close();
  return rows;
}

export function formatFactsForPrompt(facts: Fact[]): string {
  if (facts.length === 0) return "";
  const lines = facts.map((f) => `- **${f.key}**: ${f.value}`);
  return ["## Known Facts", "", ...lines, ""].join("\n");
}
