import { loadAgentConfig } from "../agent/context.js";
import { getActiveCards } from "../services/store.js";
import { getPersistedToken } from "../auth/pairing.js";
import { getLastGmailInboundAt } from "./inbound-state.js";
import { getHealthSnapshot } from "./health.js";
import type { StatusResponse } from "../api/types.js";

const processStartTime = Date.now();

/**
 * Compute high-level status for GET /api/status.
 */
export async function getStatusResponse(): Promise<StatusResponse> {
  const config = await loadAgentConfig();
  const cards = getActiveCards();
  const lastGmailAt = getLastGmailInboundAt();
  const health = getHealthSnapshot();

  // DB connectivity: if we got cards, DB is reachable
  const database: "ok" | "error" = health.components.database?.status === "ok" ? "ok" : "error";
  const gateway: "ok" | "error" = health.components.gateway?.status === "ok" ? "ok" : "error";
  const requirePairing = process.env["OPENPHONE_REQUIRE_PAIRING"] === "true";
  const paired =
    Boolean(process.env["OPENPHONE_CONTROL_TOKEN"]) || Boolean(getPersistedToken());
  const uptimeSeconds = Math.floor((Date.now() - processStartTime) / 1000);

  return {
    model: config.model,
    offlineFallback: config.offline_fallback,
    cardCount: cards.length,
    lastGmailInboundAt: lastGmailAt,
    database,
    gateway,
    requirePairing,
    paired,
    uptimeSeconds,
    health,
  };
}
