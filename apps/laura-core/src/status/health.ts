import { db } from "../db/index.js";
import { cards } from "../db/schema.js";
import type { HealthSnapshot, ComponentHealth } from "../api/types.js";

const processStartTime = Date.now();
const now = () => new Date().toISOString();

function okComponent(): ComponentHealth {
  return {
    status: "ok",
    updatedAt: now(),
    lastOk: now(),
    lastError: null,
  };
}

function dbComponent(): ComponentHealth {
  try {
    db.select().from(cards).limit(0).all();
    return okComponent();
  } catch (err) {
    return {
      status: "error",
      updatedAt: now(),
      lastOk: null,
      lastError: String(err),
    };
  }
}

/**
 * Compute health snapshot for GET /api/health.
 */
export function getHealthSnapshot(): HealthSnapshot {
  const components: Record<string, ComponentHealth> = {
    database: dbComponent(),
    gateway: okComponent(),
    gmailInbound: okComponent(),
    uiWebSocket: okComponent(),
    cronEngine: okComponent(),
  };

  return {
    pid: process.pid,
    updatedAt: now(),
    uptimeSeconds: Math.floor((Date.now() - processStartTime) / 1000),
    components,
  };
}
