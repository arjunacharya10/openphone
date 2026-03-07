import type { Message } from "@mariozechner/pi-ai";
import { runAgentTurn } from "../agent/loop.js";
import { getSessionHistory } from "../agent/sessions.js";
import { addEpisode } from "../graph/client.js";
import { ensureMemorySchema, openMemoryDb } from "./schema.js";

const HISTORY_SIZE_THRESHOLD_BYTES = 50_000;
const FLUSH_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const FLUSH_PROMPT = `Pre-compaction memory flush. Review this conversation and do the following:

1. STRUCTURED FACTS — Extract discrete, queryable facts about the user or their world and store them with set_fact.
   Use dotted-namespace keys: user.*, contact.<name>.*, preference.*, etc.
   Examples: user.spouse="Jane", user.airline_preference="Delta", contact.bob.company="Acme Corp".
   If a fact contradicts one you already know (use get_facts to check), overwrite it with set_fact.
   If a fact is no longer true, use delete_fact.

2. NARRATIVE MEMORY — Store significant events, decisions, or lessons in MEMORY.md using update_memory.
   Be concise. Only things worth remembering across sessions.

3. DAILY LOG — Record what happened today using append_daily_log (memory/YYYY-MM-DD.md).

If nothing new to store, reply with DONE.`;

const FLUSH_SYSTEM = "Memory flush turn. Extract structured facts with set_fact, narrative memory with update_memory, daily events with append_daily_log. Reply DONE if nothing to store.";

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getResolvedPrompt(): string {
  return FLUSH_PROMPT.replaceAll("YYYY-MM-DD", formatDate(new Date()));
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

function historyToText(history: Message[]): string {
  return history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const role = m.role === "user" ? "User" : "Assistant";
      const content = m.content as Array<{ type: string; text?: string }>;
      const text = content
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("");
      return `${role}: ${text}`;
    })
    .filter((line) => line.length > 10)
    .join("\n\n");
}

export async function runMemoryFlush(sessionKey: string): Promise<void> {
  const history = getSessionHistory(sessionKey);
  const prompt = getResolvedPrompt();

  await runAgentTurn({
    sessionKey,
    message: prompt,
    history,
    systemPrompt: FLUSH_SYSTEM,
  });

  // Ingest conversation into the knowledge graph (fire-and-forget)
  const episodeText = historyToText(history);
  if (episodeText.length > 50) {
    addEpisode({
      name: `session:${sessionKey}:${formatDate(new Date())}`,
      content: episodeText,
      sourceDescription: "openphone conversation",
    }).catch(() => {});
  }

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
