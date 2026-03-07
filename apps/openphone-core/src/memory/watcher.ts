import { watch } from "node:fs";
import { join } from "node:path";
import { MEMORY_DIR, MEMORY_MD_PATH, USER_MD_PATH } from "./paths.js";
import { syncFiles } from "./sync.js";

const DEBOUNCE_MS = 1500;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSync(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    syncFiles("watch").catch((err) => console.error("[memory] watch sync error:", err));
  }, DEBOUNCE_MS);
}

export function startMemoryWatcher(): void {
  const watchPath = (path: string) => {
    try {
      watch(path, { recursive: path.endsWith("memory") }, () => scheduleSync());
    } catch {}
  };
  watchPath(MEMORY_MD_PATH);
  watchPath(USER_MD_PATH);
  try {
    watch(MEMORY_DIR, { recursive: true }, () => scheduleSync());
  } catch {}
}
