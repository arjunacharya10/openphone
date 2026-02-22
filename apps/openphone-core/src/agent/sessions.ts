import type { Message } from "@mariozechner/pi-ai";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { chatSessions as chatSessionsTable } from "../db/schema.js";

const MAX_HISTORY_MESSAGES = 30;
const turnLocks = new Map<string, Promise<unknown>>();

/**
 * Load prior conversation history for a session from DB.
 * Returns empty array for new sessions.
 */
export function getSessionHistory(sessionKey: string): Message[] {
  const rows = db
    .select({ historyJson: chatSessionsTable.historyJson })
    .from(chatSessionsTable)
    .where(eq(chatSessionsTable.sessionKey, sessionKey))
    .limit(1)
    .all();

  if (rows.length === 0) return [];
  try {
    return JSON.parse(rows[0].historyJson) as Message[];
  } catch {
    return [];
  }
}

/**
 * Persist conversation history for a session to DB.
 * Trims to MAX_HISTORY_MESSAGES to avoid unbounded growth.
 */
export function setSessionHistory(sessionKey: string, history: Message[]): void {
  const trimmed =
    history.length > MAX_HISTORY_MESSAGES
      ? history.slice(-MAX_HISTORY_MESSAGES)
      : history;
  const updatedAt = new Date().toISOString();

  db.insert(chatSessionsTable)
    .values({
      sessionKey,
      historyJson: JSON.stringify(trimmed),
      updatedAt,
    })
    .onConflictDoUpdate({
      target: chatSessionsTable.sessionKey,
      set: { historyJson: JSON.stringify(trimmed), updatedAt },
    })
    .run();
}

/**
 * Ensure only one agent turn runs at a time per session.
 * Serializes concurrent chat messages so history stays consistent.
 */
export async function withSessionLock<T>(
  sessionKey: string,
  fn: () => Promise<T>
): Promise<T> {
  const prior = turnLocks.get(sessionKey) ?? Promise.resolve();
  const ourTurn = prior.then(
    () => fn(),
    () => fn()
  );
  turnLocks.set(sessionKey, ourTurn);
  return ourTurn;
}
