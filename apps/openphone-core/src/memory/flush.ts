import { loadAgentConfig } from "../agent/context.js";
import { runAgentTurn } from "../agent/loop.js";
import { getSessionHistory } from "../agent/sessions.js";
import { ensureMemorySchema, openMemoryDb } from "./schema.js";

const HISTORY_SIZE_THRESHOLD_BYTES = 50_000;
const FLUSH_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const FLUSH_PROMPT = [
  "Pre-compaction memory flush. Store durable facts from this conversation into MEMORY.md or memory/YYYY-MM-DD.md.",
  "Use update_memory or append_daily_log tools. Append only. If nothing to store, reply with DONE.",
].join(" ");
const FLUSH_SYSTEM = "Memory flush turn. Capture durable memories. Reply DONE if nothing to store.";

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getResolvedPrompt(): string {
  return FLUSH_PROMPT.replace("YYYY-MM-DD", formatDate(new Date()));
}

export function shouldRunMemoryFlush(sessionKey: string): boolean {
  const history = getSessionHistory(sessionKey);
  const historyJson = JSON.stringify(history);
  if (historyJson.length < HISTORY_SIZE_THRESHOLD_BYTES) return false;

  try {
    const db = openMemoryDb();
    ensureMemorySchema(db);
    const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(`flush:${sessionKey}`) as
      | { value: string }
      | undefined;
    db.close();
    if (!row) return true;
    const lastFlush = parseInt(row.value, 10);
    if (!Number.isFinite(lastFlush)) return true;
    return Date.now() - lastFlush > FLUSH_COOLDOWN_MS;
  } catch {
    return true;
  }
}

export async function runMemoryFlush(sessionKey: string): Promise<void> {
  const config = await loadAgentConfig();
  const systemPrompt = FLUSH_SYSTEM;
  const prompt = getResolvedPrompt();

  await runAgentTurn({
    sessionKey,
    message: prompt,
    history: getSessionHistory(sessionKey),
  });

  try {
    const db = openMemoryDb();
    ensureMemorySchema(db);
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run(
      `flush:${sessionKey}`,
      String(Date.now())
    );
    db.close();
  } catch {}
}
