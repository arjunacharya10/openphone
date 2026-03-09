/**
 * laura setup google watch
 *
 * Registers gmail.users.watch() to start push notifications flowing into
 * the Laura Pub/Sub topic. Stores the baseline historyId and expiry in config
 * so the runtime channel can resume cleanly after restarts.
 *
 * The Gmail channel (gmail.ts) handles renewal automatically at runtime —
 * it checks daily and renews when within 24h of expiry.
 *
 * Prerequisites:
 *   - npm run setup network        (Tailscale Funnel URL in config)
 *   - npm run setup google         (GOOGLE_APPLICATION_CREDENTIALS set)
 *   - npm run setup google pubsub  (topic exists in config)
 */

import { GoogleAuth } from "google-auth-library";
import { google } from "googleapis";
import { loadConfig, saveConfig, type GmailWatchState } from "../config/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTopicName(projectId: string, topicName: string): string {
  return `projects/${projectId}/topics/${topicName}`;
}

async function registerWatch(
  email: string,
  topicName: string,
): Promise<{ historyId: string; expiration: string }> {
  const auth = new GoogleAuth({
    scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
  });

  const gmail = google.gmail({ version: "v1", auth: auth as never });

  const res = await gmail.users.watch({
    userId: email,
    requestBody: {
      topicName,
      labelIds: ["INBOX"],
      labelFilterBehavior: "INCLUDE",
    },
  });

  const historyId = res.data.historyId;
  const expiration = res.data.expiration;

  if (!historyId || !expiration) {
    throw new Error("gmail.users.watch() returned incomplete response — check Pub/Sub topic permissions.");
  }

  return { historyId, expiration };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function setupGoogleWatch({ banner = true } = {}): Promise<void> {
  if (banner) console.log("▶ laura setup google watch\n");

  const config = await loadConfig();

  // Prerequisite checks
  if (!config.google?.projectId) {
    throw new Error("GCP project not configured.\nRun 'npm run setup google pubsub' first.");
  }
  if (!config.google?.pubsubTopic) {
    throw new Error("Pub/Sub topic not configured.\nRun 'npm run setup google pubsub' first.");
  }
  if (!process.env["GOOGLE_APPLICATION_CREDENTIALS"]) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set.\nRun 'npm run setup google' first.");
  }

  const { projectId, pubsubTopic } = config.google;
  const topicName = buildTopicName(projectId, pubsubTopic);

  // Determine which email to watch (from existing watch state or auth)
  let email: string;
  const existingWatch = Object.values(config.google.watches ?? {})[0];

  if (existingWatch) {
    email = existingWatch.email;
    const expiresAt = new Date(Number(existingWatch.expiration));
    console.log(`  ✓ Existing watch for ${email} (expires ${expiresAt.toLocaleDateString()})`);
    console.log("    Re-registering to refresh...\n");
  } else {
    // Derive email from credentials via Gmail profile
    const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/gmail.readonly"] });
    const gmail = google.gmail({ version: "v1", auth: auth as never });
    const profile = await gmail.users.getProfile({ userId: "me" });
    email = profile.data.emailAddress ?? "";
    if (!email) throw new Error("Could not determine Gmail address from credentials.");
    console.log(`  Registering watch for ${email}...`);
  }

  // Register watch
  const { historyId, expiration } = await registerWatch(email, topicName);
  const expiresAt = new Date(Number(expiration));

  console.log(`  ✓ Watch registered`);
  console.log(`    historyId : ${historyId}`);
  console.log(`    expires   : ${expiresAt.toISOString()} (${Math.round((expiresAt.getTime() - Date.now()) / 86400000)} days)`);

  // Persist watch state
  const watchState: GmailWatchState = { email, historyId, expiration };
  config.google = {
    ...config.google,
    watches: {
      ...(config.google.watches ?? {}),
      [email]: watchState,
    },
  };
  await saveConfig(config);
  console.log("  ✓ Watch state saved to config");

  if (banner) console.log(`
Done. Gmail push notifications are active.

  Account  : ${email}
  Topic    : ${topicName}
  Expires  : ${expiresAt.toLocaleDateString()} (auto-renewed by Laura at runtime)

Laura will start receiving Gmail notifications the next time it starts.
Run 'npm run dev' to start Laura.
`);
}
