/**
 * Safe .env file reader/writer.
 * Reads existing key=value pairs, updates or adds keys, writes back.
 * Preserves comments and blank lines. Never duplicates keys.
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

export async function setEnvVars(envPath: string, vars: Record<string, string>): Promise<void> {
  let lines: string[] = [];

  if (existsSync(envPath)) {
    const raw = await readFile(envPath, "utf-8");
    lines = raw.split("\n");
  }

  for (const [key, value] of Object.entries(vars)) {
    const idx = lines.findIndex((l) => l.startsWith(`${key}=`) || l.startsWith(`# ${key}=`));
    const entry = `${key}=${value}`;
    if (idx >= 0) {
      lines[idx] = entry;
    } else {
      lines.push(entry);
    }
  }

  // Ensure single trailing newline
  const content = lines.join("\n").trimEnd() + "\n";
  await writeFile(envPath, content, "utf-8");
}
