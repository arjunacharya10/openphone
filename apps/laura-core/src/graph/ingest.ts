import type { Message } from "@mariozechner/pi-ai";
import { getSessionHistory } from "../agent/sessions.js";
import { addEpisode } from "./client.js";

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

/**
 * Ingest the current session history into the Graphiti knowledge graph.
 * Fire-and-forget — never throws, never blocks the caller.
 * Call at natural session boundaries (disconnect, end of inbound turn).
 */
export function ingestSessionHistory(sessionKey: string, source: string): void {
  const history = getSessionHistory(sessionKey);
  const text = historyToText(history);
  if (text.length < 50) return;

  const date = new Date().toISOString().slice(0, 10);
  addEpisode({
    name: `${source}:${sessionKey}:${date}`,
    content: text,
    sourceDescription: `${source} conversation`,
  }).catch(() => {});
}
