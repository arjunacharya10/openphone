#!/usr/bin/env node
/**
 * Minimal CLI client for laura-core control plane APIs.
 * Usage: npx tsx src/ctl/cli.ts <command> [--base-url URL] [--token TOKEN]
 * Commands: status, health, tools, cron, integrations, diag, config, memory-status, memory-search, facts
 */

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cmd = args.find((a) => !a.startsWith("-"));
  const baseIdx = args.indexOf("--base-url");
  const tokenIdx = args.indexOf("--token");
  const baseUrl =
    baseIdx >= 0 ? args[baseIdx + 1] : process.env["LAURA_BASE_URL"] ?? "http://localhost:3000";
  const token =
    tokenIdx >= 0 ? args[tokenIdx + 1] : process.env["LAURA_CONTROL_TOKEN"] ?? "";

  const url = baseUrl.replace(/\/$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const fetcher = async (path: string) => {
    const res = await fetch(`${url}${path}`, { headers });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${text}`);
    return text ? JSON.parse(text) : {};
  };

  try {
    switch (cmd) {
      case "status": {
        const data = await fetcher("/api/status");
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      case "health": {
        const data = await fetcher("/api/health");
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      case "tools": {
        const data = await fetcher("/api/tools");
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      case "cron": {
        const data = await fetcher("/api/cron");
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      case "integrations": {
        const data = await fetcher("/api/integrations");
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      case "diag": {
        const data = await fetcher("/api/diag");
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      case "config": {
        const data = await fetcher("/api/config");
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      case "memory-status": {
        const data = await fetcher("/api/memory/status");
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      case "memory-search": {
        const qIdx = args.indexOf("--q") >= 0 ? args.indexOf("--q") : args.indexOf("-q");
        const q = qIdx >= 0 ? args[qIdx + 1] : "";
        if (!q) {
          console.error("memory-search requires --q <query>");
          process.exit(1);
        }
        // Proxied through laura-core to the Graphiti KG service
        const data = await fetcher(`/api/memory/search?q=${encodeURIComponent(q)}`);
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      case "facts": {
        const data = await fetcher("/api/memory/facts");
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      default:
        console.error(
          "Usage: laura-ctl <command> [--base-url URL] [--token TOKEN]\n" +
            "Commands: status, health, tools, cron, integrations, diag, config, memory-status, memory-search, facts\n" +
            "Env: LAURA_BASE_URL, LAURA_CONTROL_TOKEN"
        );
        process.exit(1);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
