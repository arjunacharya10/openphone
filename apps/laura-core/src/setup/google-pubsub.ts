/**
 * laura setup google pubsub
 *
 * Wires Gmail push notifications into Laura via Cloud Pub/Sub.
 *
 * What this does:
 *   1. Prompts for GCP project ID (stored in config for future steps)
 *   2. Creates a Pub/Sub topic (idempotent)
 *   3. Grants gmail-api-push@system.gserviceaccount.com publisher role on the topic
 *   4. Creates a push subscription pointing at the Tailscale Funnel URL
 *   5. Stores topic + subscription names in config and .env
 *
 * Prerequisites:
 *   - npm run setup network  (Tailscale Funnel URL must exist in config)
 *   - npm run setup google   (GOOGLE_APPLICATION_CREDENTIALS must be set)
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { PubSub } from "@google-cloud/pubsub";
import { loadConfig, saveConfig } from "../config/index.js";
import { setEnvVars } from "./env-writer.js";

const TOPIC_NAME = "laura-ingest";
const SUBSCRIPTION_NAME = "laura-ingest-push";
const GMAIL_PUSH_SA = "serviceAccount:gmail-api-push@system.gserviceaccount.com";
const ENV_PATH = join(fileURLToPath(new URL(".", import.meta.url)), "../../.env");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input, output });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

/** Create topic if it doesn't exist. Returns the topic object. */
async function ensureTopic(pubsub: PubSub, topicName: string) {
  const topic = pubsub.topic(topicName);
  const [exists] = await topic.exists();
  if (!exists) {
    await topic.create();
    console.log(`  ✓ Created topic: ${topicName}`);
  } else {
    console.log(`  ✓ Topic already exists: ${topicName}`);
  }
  return topic;
}

/** Grant the Gmail push SA publisher role on the topic (idempotent). */
async function grantGmailPublisher(topic: Awaited<ReturnType<typeof ensureTopic>>): Promise<void> {
  const [policy] = await topic.iam.getPolicy();
  const bindings = policy.bindings ?? [];

  const publisherBinding = bindings.find((b) => b.role === "roles/pubsub.publisher");
  if (publisherBinding) {
    const members = publisherBinding.members ?? [];
    if (members.includes(GMAIL_PUSH_SA)) {
      console.log("  ✓ Gmail publisher role already granted");
      return;
    }
    members.push(GMAIL_PUSH_SA);
    publisherBinding.members = members;
  } else {
    bindings.push({ role: "roles/pubsub.publisher", members: [GMAIL_PUSH_SA] });
  }

  policy.bindings = bindings;
  await topic.iam.setPolicy(policy);
  console.log("  ✓ Granted gmail-api-push publisher role");
}

/** Create push subscription if it doesn't exist. */
async function ensurePushSubscription(
  pubsub: PubSub,
  topic: Awaited<ReturnType<typeof ensureTopic>>,
  subscriptionName: string,
  pushEndpoint: string,
): Promise<string> {
  const subscription = pubsub.subscription(subscriptionName);
  const [exists] = await subscription.exists();

  if (!exists) {
    await topic.createSubscription(subscriptionName, {
      pushConfig: { pushEndpoint },
      ackDeadlineSeconds: 10,
      retryPolicy: {
        minimumBackoff: { seconds: 10 },
        maximumBackoff: { seconds: 600 },
      },
    });
    console.log(`  ✓ Created push subscription: ${subscriptionName}`);
  } else {
    // Update push endpoint in case the funnel URL changed
    await subscription.modifyPushConfig({ pushEndpoint });
    console.log(`  ✓ Push subscription exists, endpoint updated`);
  }

  // Return the fully-qualified subscription resource name
  return subscription.name;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function setupGooglePubSub({ banner = true } = {}): Promise<void> {
  if (banner) console.log("▶ laura setup google pubsub\n");

  // 1. Load config — check prerequisites
  const config = await loadConfig();

  if (!config.network?.funnelUrl) {
    throw new Error(
      "Tailscale Funnel URL not found in config.\nRun 'npm run setup network' first.",
    );
  }

  if (!process.env["GOOGLE_APPLICATION_CREDENTIALS"]) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS is not set.\nRun 'npm run setup google' first.",
    );
  }

  const funnelUrl = config.network.funnelUrl;
  const pushEndpoint = `${funnelUrl}/inbound/gmail`;

  // 2. Get GCP project ID
  let projectId = config.google?.projectId;
  if (!projectId) {
    console.log("  A GCP project is required for Cloud Pub/Sub.");
    console.log("  Create one free at https://console.cloud.google.com/projectcreate\n");
    projectId = await prompt("  Enter your GCP project ID: ");
    if (!projectId) throw new Error("GCP project ID is required.");
  } else {
    console.log(`  ✓ Using GCP project: ${projectId}`);
  }

  // 3. Init Pub/Sub client
  const pubsub = new PubSub({ projectId });

  // 4. Create topic
  console.log(`\n  Setting up Pub/Sub topic '${TOPIC_NAME}'...`);
  const topic = await ensureTopic(pubsub, TOPIC_NAME);

  // 5. Grant Gmail push service account publisher role
  console.log("  Granting Gmail push service account publisher role...");
  await grantGmailPublisher(topic);

  // 6. Create push subscription
  console.log(`  Setting up push subscription → ${pushEndpoint}...`);
  const subscriptionResourceName = await ensurePushSubscription(
    pubsub,
    topic,
    SUBSCRIPTION_NAME,
    pushEndpoint,
  );

  // 7. Persist to config and .env
  config.google = {
    ...config.google,
    projectId,
    pubsubTopic: TOPIC_NAME,
    pubsubSubscription: subscriptionResourceName,
  };
  await saveConfig(config);

  await setEnvVars(ENV_PATH, {
    GMAIL_PUBSUB_SUBSCRIPTION: subscriptionResourceName,
  });

  if (banner) console.log(`
Done. Gmail Pub/Sub is wired.

  Project      : ${projectId}
  Topic        : ${TOPIC_NAME}
  Subscription : ${subscriptionResourceName}
  Push endpoint: ${pushEndpoint}

Next step: run 'npm run setup google watch' to register Gmail watch and start receiving notifications.
`);
}
