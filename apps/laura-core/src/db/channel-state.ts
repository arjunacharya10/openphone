/**
 * Persistent KV store for ingest channel state.
 * Used to survive restarts — e.g. Gmail historyId per account.
 */

import { eq } from "drizzle-orm";
import { db } from "./index.js";
import { channelState } from "./schema.js";

export function getChannelState(key: string): string | null {
  const rows = db.select().from(channelState).where(eq(channelState.key, key)).limit(1).all();
  return rows[0]?.value ?? null;
}

export function setChannelState(key: string, value: string): void {
  const now = new Date().toISOString();
  db.insert(channelState)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: channelState.key, set: { value, updatedAt: now } })
    .run();
}
