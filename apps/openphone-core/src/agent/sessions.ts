import type { Message } from "@mariozechner/pi-ai";

const MAX_HISTORY_MESSAGES = 30;

const store = new Map<string, Message[]>();
const turnLocks = new Map<string, Promise<unknown>>();

/**
 * Load prior conversation history for a session.
 * Returns empty array for new sessions.
 */
export function getSessionHistory(sessionKey: string): Message[] {
  const history = store.get(sessionKey);
  return history ? [...history] : [];
}

/**
 * Persist conversation history for a session.
 * Trims to MAX_HISTORY_MESSAGES to avoid unbounded growth.
 */
export function setSessionHistory(sessionKey: string, history: Message[]): void {
  const trimmed =
    history.length > MAX_HISTORY_MESSAGES
      ? history.slice(-MAX_HISTORY_MESSAGES)
      : history;
  store.set(sessionKey, trimmed);
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
