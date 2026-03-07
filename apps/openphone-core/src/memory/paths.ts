import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "../..");
export const CONTEXT_DIR = join(PKG_ROOT, "context");
export const MEMORY_MD_PATH = join(CONTEXT_DIR, "MEMORY.md");
export const USER_MD_PATH = join(CONTEXT_DIR, "user.md");
export const MEMORY_DIR = join(CONTEXT_DIR, "memory");
