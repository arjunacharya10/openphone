import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "../..");
export const CONFIG_PATH = join(PKG_ROOT, "config", "openphone.config.json");

export interface OpenphoneConfig {
  model?: string;
  offlineFallback?: string;
  gmail?: Record<string, unknown>;
  cron?: Record<string, unknown>;
}

const DEFAULTS: OpenphoneConfig = {
  model: "openrouter/free",
  offlineFallback: "ollama/llama3.2",
  gmail: {},
  cron: {},
};

/**
 * Load config from file. Returns defaults if file is missing.
 */
export async function loadConfig(): Promise<OpenphoneConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<OpenphoneConfig>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * Save config to file. Creates parent dir if needed.
 */
export async function saveConfig(config: OpenphoneConfig): Promise<void> {
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
  const parsed = JSON.parse(content) as Partial<OpenphoneConfig>;
  await saveConfig({ ...DEFAULTS, ...parsed });
}
