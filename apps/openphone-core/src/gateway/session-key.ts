export type ParsedAgentSessionKey = {
  agentId: string;
  rest: string;
};

export const DEFAULT_AGENT_ID = "main";
export const DEFAULT_MAIN_KEY = "main";

// Pre-compiled regex (copied from OpenClaw's routing/session-key.ts)
const VALID_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const INVALID_CHARS_RE = /[^a-z0-9_-]+/g;
const LEADING_DASH_RE = /^-+/;
const TRAILING_DASH_RE = /-+$/;

function normalizeToken(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Parse agent-scoped session keys in a canonical, case-insensitive way.
 * Returned values are normalized to lowercase for stable comparisons/routing.
 *
 * Based on OpenClaw's parseAgentSessionKey implementation.
 */
export function parseAgentSessionKey(
  sessionKey: string | undefined | null
): ParsedAgentSessionKey | null {
  const raw = (sessionKey ?? "").trim().toLowerCase();
  if (!raw) {
    return null;
  }
  const parts = raw.split(":").filter(Boolean);
  if (parts.length < 3) {
    return null;
  }
  if (parts[0] !== "agent") {
    return null;
  }
  const agentId = parts[1]?.trim();
  const rest = parts.slice(2).join(":");
  if (!agentId || !rest) {
    return null;
  }
  return { agentId, rest };
}

export function normalizeMainKey(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed.toLowerCase() : DEFAULT_MAIN_KEY;
}

/**
 * Normalize an agent id to a path-safe, shell-friendly identifier.
 * Copied from OpenClaw's normalizeAgentId helper.
 */
export function normalizeAgentId(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return DEFAULT_AGENT_ID;
  }
  // Keep it path-safe + shell-friendly.
  if (VALID_ID_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  // Best-effort fallback: collapse invalid characters to "-"
  return (
    trimmed
      .toLowerCase()
      .replace(INVALID_CHARS_RE, "-")
      .replace(LEADING_DASH_RE, "")
      .replace(TRAILING_DASH_RE, "")
      .slice(0, 64) || DEFAULT_AGENT_ID
  );
}

export function buildAgentMainSessionKey(params: {
  agentId?: string | undefined;
  mainKey?: string | undefined;
}): string {
  const agentId = normalizeAgentId(params.agentId ?? DEFAULT_AGENT_ID);
  const mainKey = normalizeMainKey(params.mainKey);
  return `agent:${agentId}:${mainKey}`;
}

/**
 * Build a generic channel-scoped session key.
 * Example: agent:main:gmail:account, agent:main:ui:card:123
 */
export function buildChannelSessionKey(params: {
  agentId?: string | undefined;
  channel: string;
  parts?: string[];
}): string {
  const agentId = normalizeAgentId(params.agentId ?? DEFAULT_AGENT_ID);
  const channel = normalizeToken(params.channel) || "unknown";
  const restParts = [
    channel,
    ...(params.parts ?? []).map((p) => normalizeToken(p)).filter(Boolean),
  ];
  const rest = restParts.length > 0 ? restParts.join(":") : DEFAULT_MAIN_KEY;
  return `agent:${agentId}:${rest}`;
}

export function buildGmailSessionKey(account: string, agentId?: string): string {
  const normalizedAccount = normalizeToken(account) || "unknown";
  return buildChannelSessionKey({ agentId, channel: "gmail", parts: [normalizedAccount] });
}

export function buildUiGeneralSessionKey(agentId?: string): string {
  return buildChannelSessionKey({ agentId, channel: "ui", parts: ["general"] });
}

export function buildUiCardSessionKey(cardId: string, agentId?: string): string {
  const normalizedId = (cardId ?? "").trim() || "unknown";
  return buildChannelSessionKey({ agentId, channel: "ui", parts: ["card", normalizedId] });
}

/**
 * Ensure a session key is agent-scoped. If it's already agent-scoped, return as-is;
 * otherwise, wrap it under agent:main:<rest>.
 */
export function normalizeToAgentSessionKey(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return buildAgentMainSessionKey({ agentId: DEFAULT_AGENT_ID, mainKey: DEFAULT_MAIN_KEY });
  }
  if (parseAgentSessionKey(trimmed)) {
    return trimmed;
  }
  const rest = normalizeToken(trimmed) || DEFAULT_MAIN_KEY;
  return `agent:${normalizeAgentId(DEFAULT_AGENT_ID)}:${rest}`;
}

