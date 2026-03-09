/**
 * laura setup network
 *
 * Configures Tailscale Funnel to expose laura-core to the public internet.
 * The funnel URL is stored in laura.config.json and used as the push endpoint
 * for Gmail/Calendar Pub/Sub notifications.
 *
 * Prerequisites: Tailscale installed and logged in (https://tailscale.com/download)
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadConfig, saveConfig } from "../config/index.js";

const exec = promisify(execFile);

const PORT = Number(process.env["PORT"] ?? 3000);

// ---------------------------------------------------------------------------
// Tailscale helpers
// ---------------------------------------------------------------------------

async function run(cmd: string, args: string[]): Promise<string> {
  const { stdout } = await exec(cmd, args);
  return stdout.trim();
}

async function checkTailscale(): Promise<void> {
  try {
    await run("tailscale", ["version"]);
  } catch {
    throw new Error(
      "Tailscale is not installed or not in PATH.\n" +
        "Install it at https://tailscale.com/download then run 'tailscale up'.",
    );
  }
}

async function getTailscaleStatus(): Promise<{ dnsName: string; online: boolean }> {
  const raw = await run("tailscale", ["status", "--json"]);
  const status = JSON.parse(raw) as {
    Self?: { DNSName?: string; Online?: boolean };
  };

  const dnsName = status.Self?.DNSName?.replace(/\.$/, "") ?? "";
  const online = status.Self?.Online ?? false;

  if (!dnsName) {
    throw new Error("Could not determine Tailscale hostname. Run 'tailscale up' first.");
  }

  return { dnsName, online };
}

async function enableFunnel(port: number): Promise<void> {
  // tailscale funnel --bg <port> sets up a persistent background funnel
  try {
    await run("tailscale", ["funnel", "--bg", String(port)]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // If funnel is already active, tailscale exits non-zero — that's fine
    if (!msg.includes("already")) throw err;
  }
}

async function getFunnelUrl(dnsName: string, port: number): Promise<string> {
  // Verify the funnel is active and return the stable public URL
  const raw = await run("tailscale", ["funnel", "status", "--json"]).catch(() => "{}");
  const status = JSON.parse(raw) as {
    TCP?: Record<string, unknown>;
    Web?: Record<string, unknown>;
  };

  // Funnel URL is always https://<dnsName> on port 443 (Tailscale terminates TLS)
  // The local port is what we mapped, but the public URL is always 443
  const hasActiveFunnel = Object.keys(status.Web ?? {}).length > 0 ||
    Object.keys(status.TCP ?? {}).length > 0;

  if (!hasActiveFunnel) {
    throw new Error(`Funnel does not appear to be active for port ${port}. Try running 'tailscale funnel ${port}' manually.`);
  }

  return `https://${dnsName}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function setupNetwork(): Promise<void> {
  console.log("▶ laura setup network\n");

  // 1. Check Tailscale is installed
  console.log("  Checking Tailscale...");
  await checkTailscale();
  console.log("  ✓ Tailscale found");

  // 2. Check Tailscale is connected
  console.log("  Checking Tailscale connection...");
  const { dnsName, online } = await getTailscaleStatus();
  if (!online) {
    throw new Error("Tailscale is installed but not connected. Run 'tailscale up'.");
  }
  console.log(`  ✓ Connected as ${dnsName}`);

  // 3. Enable Funnel on the Laura port
  console.log(`  Enabling Tailscale Funnel on port ${PORT}...`);
  await enableFunnel(PORT);
  console.log(`  ✓ Funnel active`);

  // 4. Derive the public URL
  const funnelUrl = await getFunnelUrl(dnsName, PORT);
  console.log(`  ✓ Public URL: ${funnelUrl}`);

  // 5. Persist to config
  const config = await loadConfig();
  config.network = { funnelUrl, port: PORT };
  await saveConfig(config);
  console.log(`  ✓ Saved to laura.config.json`);

  console.log(`
Done. Laura is reachable at:

  ${funnelUrl}

This URL will be used as the push endpoint for Gmail and Calendar notifications.
Next step: run 'npm run setup google' to wire G Suite.
`);
}
