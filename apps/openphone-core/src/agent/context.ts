import { readFile, appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CONTEXT_DIR = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../context"
);

export const USER_MD_PATH = join(CONTEXT_DIR, "user.md");

/** Paths allowed for memory_get. MEMORY.md, user.md, memory/*.md */
function isAllowedMemoryPath(relPath: string): boolean {
  const n = relPath.trim().replace(/\\/g, "/");
  if (n === "MEMORY.md" || n === "memory.md" || n === "user.md") return true;
  if (n.startsWith("memory/") && n.endsWith(".md")) return true;
  return false;
}
export const AGENT_FILE_PATH = join(CONTEXT_DIR, "openphone.agent");
export const SOUL_MD_PATH = join(CONTEXT_DIR, "SOUL.md");
export const AGENTS_MD_PATH = join(CONTEXT_DIR, "AGENTS.md");
export const MEMORY_MD_PATH = join(CONTEXT_DIR, "MEMORY.md");
const MEMORY_DIR = join(CONTEXT_DIR, "memory");

export interface AgentConfig {
  name: string;
  model: string;
  offline_fallback?: string;
}

export async function loadAgentConfig(): Promise<AgentConfig> {
  const raw = await readFile(AGENT_FILE_PATH, "utf-8");
  return parseAgentFile(raw);
}

async function loadFile(path: string): Promise<string> {
  return readFile(path, "utf-8").catch(() => "");
}

function formatDateYMD(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function loadSoul(): Promise<string> {
  return loadFile(SOUL_MD_PATH);
}

export async function loadAgents(): Promise<string> {
  return loadFile(AGENTS_MD_PATH);
}

export async function loadUserContext(): Promise<string> {
  return loadFile(USER_MD_PATH);
}

export async function loadMemory(): Promise<string> {
  return loadFile(MEMORY_MD_PATH);
}

export async function loadDailyMemory(): Promise<string> {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayStr = formatDateYMD(today);
  const yesterdayStr = formatDateYMD(yesterday);
  const [todayContent, yesterdayContent] = await Promise.all([
    loadFile(join(MEMORY_DIR, `${todayStr}.md`)),
    loadFile(join(MEMORY_DIR, `${yesterdayStr}.md`)),
  ]);
  const parts: string[] = [];
  if (yesterdayContent.trim()) {
    parts.push(`### ${yesterdayStr}`, yesterdayContent.trim(), "");
  }
  if (todayContent.trim()) {
    parts.push(`### ${todayStr}`, todayContent.trim());
  }
  return parts.join("\n");
}

export async function appendUserContext(content: string): Promise<void> {
  const timestamp = formatDateYMD(new Date());
  await appendFile(
    USER_MD_PATH,
    `\n## Observed [${timestamp}]\n\n${content.trim()}\n`
  );
}

export async function appendMemory(content: string): Promise<void> {
  const timestamp = formatDateYMD(new Date());
  await appendFile(
    MEMORY_MD_PATH,
    `\n## [${timestamp}]\n\n${content.trim()}\n`
  );
}

export async function appendDailyLog(content: string): Promise<void> {
  await mkdir(MEMORY_DIR, { recursive: true });
  const dateStr = formatDateYMD(new Date());
  const path = join(MEMORY_DIR, `${dateStr}.md`);
  const header = `# ${dateStr}\n\n`;
  const existing = await loadFile(path);
  const toAppend = existing ? `\n${content.trim()}\n` : `${header}${content.trim()}\n`;
  await appendFile(path, toAppend);
}

export interface ReadMemoryFileResult {
  path: string;
  text: string;
}

/** Read a memory file (MEMORY.md, user.md, memory/YYYY-MM-DD.md). Safe paths only. */
export async function readMemoryFile(params: {
  path: string;
  from?: number;
  lines?: number;
}): Promise<ReadMemoryFileResult> {
  const rawPath = params.path.trim().replace(/\\/g, "/");
  if (!rawPath || rawPath.includes("..")) {
    throw new Error("path required");
  }
  if (!isAllowedMemoryPath(rawPath)) {
    throw new Error(
      "path must be MEMORY.md, user.md, or memory/YYYY-MM-DD.md"
    );
  }
  const absPath = join(CONTEXT_DIR, rawPath);
  const content = await loadFile(absPath);
  const relPath = rawPath;
  if (params.from == null && params.lines == null) {
    return { path: relPath, text: content };
  }
  const lines = content.split("\n");
  const start = Math.max(1, params.from ?? 1);
  const count = Math.max(1, params.lines ?? lines.length);
  const slice = lines.slice(start - 1, start - 1 + count);
  return { path: relPath, text: slice.join("\n") };
}

export async function buildSystemPrompt(
  config: AgentConfig,
  cardContext?: { title: string; context: string }
): Promise<string> {
  const [soul, agents, userMd, memory, daily] = await Promise.all([
    loadSoul(),
    loadAgents(),
    loadUserContext(),
    loadMemory(),
    loadDailyMemory(),
  ]);

  const sections: string[] = [];

  if (soul.trim()) {
    sections.push(soul.trim(), "");
  }
  if (agents.trim()) {
    sections.push(agents.trim(), "");
  }

  sections.push("## User Context", "", userMd.trim() || "(no user context loaded yet)", "");

  sections.push("## Memory", "");
  if (memory.trim() || daily.trim()) {
    if (memory.trim()) sections.push(memory.trim(), "");
    if (daily.trim()) sections.push("### Recent (daily)", "", daily.trim());
  } else {
    sections.push("(no memory loaded yet)");
  }

  if (cardContext) {
    sections.push("", "## Current card", "", `**${cardContext.title}**`, "", cardContext.context.trim() || "(no context)", "");
  }

  return sections.join("\n");
}

function parseAgentFile(content: string): AgentConfig {
  const lines = content.split("\n");
  const meta: Record<string, string> = {};

  for (const line of lines) {
    if (line.trim() === "" || line.startsWith("#")) break;
    const colon = line.indexOf(":");
    if (colon > 0) {
      meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    }
  }

  return {
    name: meta["name"] ?? "openphone",
    model: meta["model"] ?? "anthropic/claude-opus-4-6",
    offline_fallback: meta["offline_fallback"],
  };
}
