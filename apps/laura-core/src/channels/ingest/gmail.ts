import type { FastifyInstance } from "fastify";
import { PubSub, type Message } from "@google-cloud/pubsub";
import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";
import type { OAuth2Client } from "google-auth-library";
import type { IngestChannel, Logger } from "../traits.js";
import {
  createInboundDebouncer,
  runSerializedForKey,
  createSemaphore,
} from "../../inbound/index.js";
import type { InboundMessage } from "../../gateway/types.js";
import { buildGmailSessionKey } from "../../gateway/session-key.js";
import { dispatchInboundMessage } from "../../gateway/dispatch.js";
import { ingestSessionHistory } from "../../graph/ingest.js";
import { setLastGmailInboundAt } from "../../status/inbound-state.js";
import { publish } from "../../lib/event-bus.js";
import { loadConfig, saveConfig, type GmailWatchState } from "../../config/index.js";
import { getChannelState, setChannelState } from "../../db/channel-state.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GmailMessage {
  id?: string;
  threadId?: string;
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  snippet?: string;
  body?: string;
  bodyTruncated?: boolean;
  labels?: string[];
}

interface GmailInboundItem {
  eventDescription: string;
  messages: GmailMessage[];
  account: string;
  historyId: string;
}

// Raw notification pushed by Gmail via Cloud Pub/Sub
interface GmailPubSubNotification {
  emailAddress: string;
  historyId: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = Number(process.env["INBOUND_DEBOUNCE_MS"]) || 500;
const MAX_CONCURRENT = Number(process.env["INBOUND_MAX_CONCURRENT"]) || 5;

/**
 * Full Pub/Sub subscription resource name.
 * Format: projects/<project-id>/subscriptions/<subscription-id>
 */
const SUBSCRIPTION_NAME = process.env["GMAIL_PUBSUB_SUBSCRIPTION"] ?? "";

// ---------------------------------------------------------------------------
// Gmail API helpers
// ---------------------------------------------------------------------------

/** Build an authenticated Gmail client using Application Default Credentials.
 *  Run `gcloud auth application-default login` (or set GOOGLE_APPLICATION_CREDENTIALS)
 *  to configure credentials once on the device. */
function createGmailClient(): ReturnType<typeof google.gmail> {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
  });
  return google.gmail({ version: "v1", auth: auth as unknown as OAuth2Client });
}

function headerValue(headers: Array<{ name?: string | null; value?: string | null }>, name: string): string {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function extractMessage(raw: {
  id?: string | null;
  threadId?: string | null;
  snippet?: string | null;
  labelIds?: string[] | null;
  payload?: {
    headers?: Array<{ name?: string | null; value?: string | null }> | null;
  } | null;
}): GmailMessage {
  const headers = raw.payload?.headers ?? [];
  return {
    id: raw.id ?? undefined,
    threadId: raw.threadId ?? undefined,
    from: headerValue(headers, "from"),
    to: headerValue(headers, "to"),
    subject: headerValue(headers, "subject"),
    date: headerValue(headers, "date"),
    snippet: raw.snippet ?? undefined,
    labels: raw.labelIds ?? undefined,
  };
}

/** Fetch messages added to INBOX since startHistoryId. */
async function fetchNewMessages(
  client: ReturnType<typeof google.gmail>,
  userId: string,
  startHistoryId: string,
): Promise<GmailMessage[]> {
  const historyRes = await client.users.history.list({
    userId,
    startHistoryId,
    historyTypes: ["messageAdded"],
    labelId: "INBOX",
  });

  const addedIds = (historyRes.data.history ?? [])
    .flatMap((h) => h.messagesAdded ?? [])
    .map((m) => m.message?.id)
    .filter(Boolean) as string[];

  if (addedIds.length === 0) return [];

  const messages = await Promise.all(
    addedIds.slice(0, 10).map((id) =>
      client.users.messages.get({ userId, id, format: "metadata",
        metadataHeaders: ["From", "To", "Subject", "Date"] })
        .then((r) => extractMessage(r.data)),
    ),
  );

  return messages;
}

// ---------------------------------------------------------------------------
// Watch renewal
// ---------------------------------------------------------------------------

const RENEWAL_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const RENEWAL_THRESHOLD_MS = 24 * 60 * 60 * 1000;      // renew when < 24h remaining

async function renewWatch(
  email: string,
  topicName: string,
  logger: Logger,
): Promise<GmailWatchState | null> {
  try {
    const auth = new GoogleAuth({
      scopes: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
    });
    const gmail = google.gmail({ version: "v1", auth: auth as never });
    const res = await gmail.users.watch({
      userId: email,
      requestBody: { topicName, labelIds: ["INBOX"], labelFilterBehavior: "INCLUDE" },
    });

    const historyId = res.data.historyId;
    const expiration = res.data.expiration;
    if (!historyId || !expiration) return null;

    const state: GmailWatchState = { email, historyId, expiration };
    const config = await loadConfig();
    config.google = {
      ...config.google,
      watches: { ...(config.google?.watches ?? {}), [email]: state },
    };
    await saveConfig(config);
    logger.info({ email, expiration }, "gmail: watch renewed");
    return state;
  } catch (err) {
    logger.error({ err, email }, "gmail: watch renewal failed");
    return null;
  }
}

function startRenewalTimer(
  watches: Record<string, GmailWatchState>,
  projectId: string,
  topicName: string,
  logger: Logger,
): NodeJS.Timeout {
  const fullTopicName = `projects/${projectId}/topics/${topicName}`;

  return setInterval(async () => {
    for (const [email, state] of Object.entries(watches)) {
      const expiresAt = Number(state.expiration);
      const remaining = expiresAt - Date.now();
      if (remaining < RENEWAL_THRESHOLD_MS) {
        logger.info({ email, remaining }, "gmail: watch expiring soon, renewing");
        const updated = await renewWatch(email, fullTopicName, logger);
        if (updated) watches[email] = updated;
      }
    }
  }, RENEWAL_CHECK_INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// Channel
// ---------------------------------------------------------------------------

export function createGmailIngestChannel(logger: Logger): IngestChannel {
  const semaphore = createSemaphore(MAX_CONCURRENT);

  // Seeded from config on start() — survives restarts
  const lastHistoryIds = new Map<string, string>();

  let pubsubSubscription: ReturnType<InstanceType<typeof PubSub>["subscription"]> | null = null;
  let renewalTimer: NodeJS.Timeout | null = null;
  let fallbackTimer: NodeJS.Timeout | null = null;

  const debouncer = createInboundDebouncer<GmailInboundItem>({
    debounceMs: DEBOUNCE_MS,
    buildKey: (item) => `gmail:${item.account}`,
    onFlush: async (items) => {
      if (items.length === 0) return;
      const account = items[0].account;
      logger.info({ account, count: items.length }, "gmail.debouncer.flush");

      const body =
        items.length === 1
          ? items[0].eventDescription
          : items.map((i) => i.eventDescription).filter(Boolean).join(" | ");

      const sessionKey = buildGmailSessionKey(account);

      await runSerializedForKey(`gmail:${account}`, async () => {
        await semaphore.acquire();
        try {
          const inbound: InboundMessage = {
            sessionKey,
            body,
            source: "gmail",
            metadata: { account, historyId: items[0]?.historyId, itemCount: items.length },
          };
          const result = await dispatchInboundMessage(inbound);
          ingestSessionHistory(sessionKey, "gmail");
          setLastGmailInboundAt();
          publish({ type: "ingest:received", payload: { channel: "gmail", summary: body.slice(0, 120) } });
          logger.info({ sessionKey, toolCallCount: result.toolCallCount }, "gmail agent turn done");
        } catch (err) {
          logger.error({ err, sessionKey }, "gmail agent turn failed");
        } finally {
          semaphore.release();
        }
      });
    },
    onError: (err, items) => {
      logger.error({ err, account: items[0]?.account }, "gmail debouncer error");
    },
  });

  function dbKey(email: string): string {
    return `gmail:historyId:${email}`;
  }

  function persistHistoryId(email: string, historyId: string): void {
    lastHistoryIds.set(email, historyId);
    setChannelState(dbKey(email), historyId);
  }

  async function processNewMessages(
    gmailClient: ReturnType<typeof google.gmail>,
    email: string,
    fromHistoryId: string,
    toHistoryId: string,
  ): Promise<void> {
    const messages = await fetchNewMessages(gmailClient, email, fromHistoryId);
    persistHistoryId(email, toHistoryId);

    if (messages.length === 0) return;

    const parts = messages.slice(0, 10).map((m) => `"${m.subject ?? "(no subject)"}" from ${m.from ?? "unknown"}`);
    const eventDescription = `New Gmail: ${messages.length} message(s) — ${parts.join("; ")}`;
    await debouncer.enqueue({ eventDescription, messages, account: email, historyId: toHistoryId });
  }

  async function handleNotification(
    gmailClient: ReturnType<typeof google.gmail>,
    notification: GmailPubSubNotification,
  ): Promise<void> {
    const { emailAddress, historyId } = notification;
    const lastHistoryId = lastHistoryIds.get(emailAddress);

    if (!lastHistoryId) {
      // No baseline yet — establish it and wait for next notification
      persistHistoryId(emailAddress, historyId);
      logger.info({ account: emailAddress, historyId }, "gmail: baseline established");
      return;
    }

    if (lastHistoryId === historyId) return; // nothing new

    await processNewMessages(gmailClient, emailAddress, lastHistoryId, historyId);
  }

  /** Fallback poll: scan history.list for each watched account to catch dropped notifications. */
  async function fallbackPoll(gmailClient: ReturnType<typeof google.gmail>): Promise<void> {
    for (const [email, lastHistoryId] of lastHistoryIds) {
      try {
        // Get current historyId from Gmail to compare
        const profile = await gmailClient.users.getProfile({ userId: email });
        const currentHistoryId = profile.data.historyId;
        if (!currentHistoryId || currentHistoryId === lastHistoryId) continue;

        logger.info({ email, lastHistoryId, currentHistoryId }, "gmail: fallback poll found gap, catching up");
        await processNewMessages(gmailClient, email, lastHistoryId, currentHistoryId);
      } catch (err) {
        logger.error({ err, email }, "gmail: fallback poll failed");
      }
    }
  }

  return {
    id: "gmail",

    // Pub/Sub driven — no webhook route needed
    register(_app: FastifyInstance): void {},

    async start(): Promise<void> {
      if (!SUBSCRIPTION_NAME) {
        logger.warn({}, "gmail: GMAIL_PUBSUB_SUBSCRIPTION not set — ingest disabled");
        return;
      }

      // Seed lastHistoryIds — DB wins (most current), falls back to config watch state
      const config = await loadConfig();
      const watches = config.google?.watches ?? {};
      for (const [email, state] of Object.entries(watches)) {
        const dbHistoryId = getChannelState(`gmail:historyId:${email}`);
        const historyId = dbHistoryId ?? state.historyId;
        lastHistoryIds.set(email, historyId);
        logger.info({ email, historyId, source: dbHistoryId ? "db" : "config" }, "gmail: seeded historyId");
      }

      // Start watch renewal timer if watch state and GCP config are present
      if (config.google?.projectId && config.google?.pubsubTopic && Object.keys(watches).length > 0) {
        renewalTimer = startRenewalTimer(
          watches,
          config.google.projectId,
          config.google.pubsubTopic,
          logger,
        );
        logger.info({}, "gmail: watch renewal timer started (checks every 24h)");
      }

      const gmailClient = createGmailClient();
      const pubsub = new PubSub();
      const subscription = pubsub.subscription(SUBSCRIPTION_NAME);
      pubsubSubscription = subscription;

      subscription.on("message", (message: Message) => {
        // Ack immediately (at-most-once) — missed notifications are caught on next push
        message.ack();

        void (async () => {
          try {
            const raw = JSON.parse(Buffer.from(message.data as unknown as string, "base64").toString()) as GmailPubSubNotification;
            await handleNotification(gmailClient, raw);
          } catch (err) {
            logger.error({ err }, "gmail: failed to process pubsub notification");
          }
        })();
      });

      subscription.on("error", (err: Error) => {
        logger.error({ err }, "gmail: pubsub subscription error");
      });

      logger.info({ subscription: SUBSCRIPTION_NAME }, "gmail: pubsub subscriber started");

      // Fallback poll every 30min — catches notifications dropped by Pub/Sub
      const FALLBACK_INTERVAL_MS = 30 * 60 * 1000;
      fallbackTimer = setInterval(() => {
        void fallbackPoll(gmailClient).catch((err) => {
          logger.error({ err }, "gmail: fallback poll error");
        });
      }, FALLBACK_INTERVAL_MS);
    },

    async stop(): Promise<void> {
      if (renewalTimer) clearInterval(renewalTimer);
      if (fallbackTimer) clearInterval(fallbackTimer);
      await pubsubSubscription?.close();
    },
  };
}
