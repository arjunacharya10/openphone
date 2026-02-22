import { readFile, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CONTEXT_DIR = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../context"
);

export const USER_MD_PATH = join(CONTEXT_DIR, "user.md");
export const AGENT_FILE_PATH = join(CONTEXT_DIR, "openphone.agent");

export interface AgentConfig {
  name: string;
  model: string;
  offline_fallback?: string;
  systemPrompt: string;
}

export async function loadAgentConfig(): Promise<AgentConfig> {
  const raw = await readFile(AGENT_FILE_PATH, "utf-8");
  return parseAgentFile(raw);
}

export async function loadUserContext(): Promise<string> {
  return readFile(USER_MD_PATH, "utf-8").catch(() => "");
}

export async function appendUserContext(content: string): Promise<void> {
  const timestamp = new Date().toISOString().split("T")[0];
  await appendFile(
    USER_MD_PATH,
    `\n## Observed [${timestamp}]\n\n${content.trim()}\n`
  );
}

export function buildSystemPrompt(config: AgentConfig, userMd: string): string {
  return [
    config.systemPrompt,
    "",
    "## User Context",
    "",
    userMd || "(no user context loaded yet)",
  ].join("\n");
}

function parseAgentFile(content: string): AgentConfig {
  const lines = content.split("\n");
  const meta: Record<string, string> = {};
  let bodyStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "" || line.startsWith("#")) {
      bodyStart = i + 1;
      break;
    }
    const colon = line.indexOf(":");
    if (colon > 0) {
      meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    }
  }

  return {
    name: meta["name"] ?? "openphone",
    model: meta["model"] ?? "anthropic/claude-opus-4-6",
    offline_fallback: meta["offline_fallback"],
    systemPrompt: lines.slice(bodyStart).join("\n").trim(),
  };
}
