import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "../..");
export const CONFIG_PATH = join(PKG_ROOT, "config", "laura.config.json");

export interface NetworkConfig {
  /** Tailscale Funnel URL exposed to the public internet (e.g. https://hostname.ts.net) */
  funnelUrl?: string;
  /** Local port Laura listens on */
  port?: number;
}

export interface GmailWatchState {
  email: string;
  historyId: string;
  /** Unix timestamp in ms — watch expires after 7 days */
  expiration: string;
}

export interface GoogleConfig {
  projectId?: string;
  pubsubTopic?: string;
  pubsubSubscription?: string;
  /** Active gmail.users.watch() state, keyed by email address */
  watches?: Record<string, GmailWatchState>;
}

export interface LauraConfig {
  model?: string;
  offlineFallback?: string;
  gmail?: Record<string, unknown>;
  cron?: Record<string, unknown>;
  network?: NetworkConfig;
  google?: GoogleConfig;
}

const DEFAULTS: LauraConfig = {
  model: "openrouter/free",
  offlineFallback: "ollama/llama3.2",
  gmail: {},
  cron: {},
};

/**
 * Load config from file. Returns defaults if file is missing.
 */
export async function loadConfig(): Promise<LauraConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<LauraConfig>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * Save config to file. Creates parent dir if needed.
 */
export async function saveConfig(config: LauraConfig): Promise<void> {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  const content = JSON.stringify(config, null, 2);
  await writeFile(CONFIG_PATH, content, "utf-8");
}

/**
 * Get raw config file content for GET /api/config.
 */
export async function getConfigContent(): Promise<string> {
  try {
    return await readFile(CONFIG_PATH, "utf-8");
  } catch {
    return JSON.stringify(DEFAULTS, null, 2);
  }
}

/**
 * Write raw config content for PUT /api/config.
 */
export async function setConfigContent(content: string): Promise<void> {
  const parsed = JSON.parse(content) as Partial<LauraConfig>;
  await saveConfig({ ...DEFAULTS, ...parsed });
}
