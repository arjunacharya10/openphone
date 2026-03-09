/**
 * laura setup <command>
 *
 * One-time setup commands for wiring Laura's external integrations.
 * These run locally and do not require the laura-core server to be running.
 *
 * Usage:
 *   npm run setup network   — configure Tailscale Funnel
 *   npm run setup google    — wire all G Suite integrations (auth + pubsub + watch)
 *
 * Advanced (run individual steps):
 *   npm run setup google auth    — OAuth2 only
 *   npm run setup google pubsub  — Pub/Sub topic + subscription only
 *   npm run setup google watch   — Gmail watch registration only
 */

import { setupNetwork } from "./network.js";
import { setupGoogleAuth } from "./google.js";
import { setupGooglePubSub } from "./google-pubsub.js";
import { setupGoogleWatch } from "./google-watch.js";

const [, , command, subcommand] = process.argv;

// ---------------------------------------------------------------------------
// Orchestrated flows
// ---------------------------------------------------------------------------

async function setupGoogle(): Promise<void> {
  const width = 52;
  const line = "─".repeat(width);

  console.log(`\n┌${line}┐`);
  console.log(`│${"  laura  ·  G Suite Setup".padEnd(width)}│`);
  console.log(`└${line}┘\n`);
  console.log("This will configure Gmail push notifications in 3 steps.\n");

  // Step 1 — Auth
  console.log(`Step 1/3  Google OAuth2\n${line}`);
  await setupGoogleAuth({ banner: false });

  // Step 2 — Pub/Sub
  console.log(`\nStep 2/3  Cloud Pub/Sub\n${line}`);
  await setupGooglePubSub({ banner: false });

  // Step 3 — Gmail watch
  console.log(`\nStep 3/3  Gmail watch\n${line}`);
  await setupGoogleWatch({ banner: false });

  // Summary
  console.log(`\n┌${line}┐`);
  console.log(`│${"  ✓  G Suite fully configured".padEnd(width)}│`);
  console.log(`└${line}┘`);
  console.log(`
Laura will now receive Gmail push notifications automatically.
Start Laura with: npm run dev
`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (command === "network") {
    await setupNetwork();
    return;
  }

  if (command === "google") {
    // No subcommand — run the full orchestrated flow
    if (!subcommand) {
      await setupGoogle();
      return;
    }
    if (subcommand === "auth") { await setupGoogleAuth(); return; }
    if (subcommand === "pubsub") { await setupGooglePubSub(); return; }
    if (subcommand === "watch") { await setupGoogleWatch(); return; }
  }

  console.log(`
laura setup <command>

Commands:
  network   Configure Tailscale Funnel   (run this first)
  google    Wire all G Suite integrations (run this second)

Run in order:
  npm run setup network
  npm run setup google

Advanced — run individual steps:
  npm run setup google auth
  npm run setup google pubsub
  npm run setup google watch
`);
  process.exit(command ? 1 : 0);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n✗ ${msg}\n`);
  console.error("Fix the issue above and re-run — setup is safe to re-run at any step.\n");
  process.exit(1);
});
