/**
 * ZeroClaw-inspired control plane API types for openphone-core.
 * Adapted for a single EA device; reduced from ZeroClaw's full surface.
 */

/** High-level status snapshot (GET /api/status). */
export interface StatusResponse {
  /** Agent model string, e.g. openrouter/free */
  model: string;
  /** Offline fallback model if configured */
  offlineFallback?: string;
  /** Pending cards count */
  cardCount: number;
  /** Last Gmail inbound timestamp (ISO) or null */
  lastGmailInboundAt: string | null;
  /** Database connectivity */
  database: "ok" | "error";
  /** Gateway ready to receive inbound */
  gateway: "ok" | "error";
  /** Whether control plane pairing is required */
  requirePairing: boolean;
  /** Whether device is paired (has valid token) */
  paired: boolean;
  /** Uptime in seconds */
  uptimeSeconds: number;
  /** Nested health snapshot */
  health: HealthSnapshot;
}

/** Per-subsystem health (GET /api/health). */
export interface HealthSnapshot {
  /** Process ID */
  pid: number;
  /** When this snapshot was computed (ISO) */
  updatedAt: string;
  /** Uptime in seconds */
  uptimeSeconds: number;
  /** Per-component status */
  components: Record<string, ComponentHealth>;
}

export interface ComponentHealth {
  /** ok | degraded | error */
  status: "ok" | "degraded" | "error";
  /** When this component was last checked (ISO) */
  updatedAt: string;
  /** Last successful check (ISO) or null */
  lastOk: string | null;
  /** Last error message if any */
  lastError: string | null;
}

/** Tool introspection (GET /api/tools). */
export interface ToolSpec {
  name: string;
  description: string;
  /** Safe parameter schema (names/types only, no secrets) */
  parameters?: Record<string, string>;
}

/** Cron job (GET/POST/PUT/DELETE /api/cron). */
export interface CronJob {
  id: string;
  name: string | null;
  /** Cron expression or preset (e.g. "0 9 * * *" or "daily") */
  schedule: string;
  /** Session key for agent turn, e.g. agent:main:cron:daily */
  sessionKey: string;
  /** Message body sent to agent when job fires */
  message: string;
  enabled: boolean;
  /** Next run (ISO) if known */
  nextRun: string | null;
  /** Last run (ISO) or null */
  lastRun: string | null;
  /** Last run result: ok | error */
  lastStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Integration status (GET /api/integrations). */
export interface Integration {
  name: string;
  description: string;
  status: "available" | "active" | "disabled" | "error";
}

/** Config response (GET /api/config). */
export interface ConfigResponse {
  format: "json";
  content: string;
}

/** Pairing response (POST /pair). */
export interface PairResponse {
  token: string;
}
