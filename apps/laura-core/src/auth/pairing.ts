import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PAIRING_CODE_LENGTH = 6;
const PAIRING_CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const TOKEN_LENGTH = 32;

let pairingCode: string | null = null;
let pairingCodeExpiry: number = 0;

function getTokenPath(): string {
  const home = process.env["HOME"] ?? process.env["USERPROFILE"] ?? ".";
  const dir = join(home, ".laura");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  return join(dir, "control_token");
}

/**
 * Generate a new pairing code (6 alphanumeric chars).
 * Caller should display this to the user; it expires after 10 minutes.
 */
export function generatePairingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = randomBytes(PAIRING_CODE_LENGTH);
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
    code += chars[bytes[i]! % chars.length];
  }
  pairingCode = code;
  pairingCodeExpiry = Date.now() + PAIRING_CODE_EXPIRY_MS;
  return code;
}

/**
 * Get current pairing code if valid (not expired).
 */
export function getPairingCode(): string | null {
  if (!pairingCode || Date.now() > pairingCodeExpiry) {
    pairingCode = null;
    return null;
  }
  return pairingCode;
}

/**
 * Validate pairing code and issue token. Returns token or null.
 */
export function pairWithCode(code: string): string | null {
  const trimmed = (code ?? "").trim().toUpperCase();
  if (!trimmed || !pairingCode || Date.now() > pairingCodeExpiry) {
    return null;
  }
  if (trimmed !== pairingCode) {
    return null;
  }
  pairingCode = null;
  pairingCodeExpiry = 0;
  const token = randomBytes(TOKEN_LENGTH).toString("hex");
  const path = getTokenPath();
  writeFileSync(path, token, { mode: 0o600 });
  return token;
}

/**
 * Load persisted token from file.
 */
export function getPersistedToken(): string | null {
  const path = getTokenPath();
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf-8").trim() || null;
  } catch {
    return null;
  }
}

/**
 * Check if the given token is valid (matches persisted token or env override).
 */
export function validateToken(token: string | undefined | null): boolean {
  if (!token || typeof token !== "string") return false;
  const trimmed = token.trim();
  if (!trimmed) return false;
  const envToken = process.env["LAURA_CONTROL_TOKEN"];
  if (envToken && envToken.trim() === trimmed) return true;
  const persisted = getPersistedToken();
  return persisted !== null && persisted === trimmed;
}
