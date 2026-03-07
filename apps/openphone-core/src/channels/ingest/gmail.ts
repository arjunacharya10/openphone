import type { FastifyInstance } from "fastify";
import type { IngestChannel, Logger } from "../traits.js";
import {
  createInboundDebouncer,
  runSerializedForKey,
  createSemaphore,
} from "../../inbound/index.js";
import type { InboundMessage } from "../../gateway/types.js";
import { buildGmailSessionKey } from "../../gateway/session-key.js";
import { dispatchInboundMessage } from "../../gateway/dispatch.js";
import { setLastGmailInboundAt } from "../../status/inbound-state.js";
import { publish } from "../../lib/event-bus.js";

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

export interface GmailHookPayload {
  source?: string;
  account?: string;
  historyId?: string;
  deletedMessageIds?: string[];
  messages?: GmailMessage[];
}

interface GmailInboundItem {
  eventDescription: string;
  messages: GmailMessage[];
  account: string;
  historyId: string;
}

const DEBOUNCE_MS = Number(process.env["INBOUND_DEBOUNCE_MS"]) || 500;
const MAX_CONCURRENT = Number(process.env["INBOUND_MAX_CONCURRENT"]) || 5;

export function createGmailIngestChannel(logger: Logger): IngestChannel {
  const semaphore = createSemaphore(MAX_CONCURRENT);

  const debouncer = createInboundDebouncer<GmailInboundItem>({
    debounceMs: DEBOUNCE_MS,
    buildKey: (item) => (item.account ? `gmail:${item.account}` : null),
    onFlush: async (items) => {
      if (items.length === 0) return;
      const account = items[0].account;
      logger.info({ account, count: items.length }, "gmail.debouncer.flush");

      const body =
        items.length === 1
          ? items[0].eventDescription
          : items
              .map((i) => i.eventDescription)
              .filter(Boolean)
              .join(" | ");

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

  async function handleWebhook(payload: GmailHookPayload): Promise<void> {
    const messages = payload.messages ?? [];
    const account = payload.account ?? "unknown";
    const historyId = payload.historyId ?? "";

    const parts = messages.slice(0, 10).map((m) => {
      const subj = m.subject ?? "(no subject)";
      const from = m.from ?? "unknown";
      return `"${subj}" from ${from}`;
    });

    const eventDescription =
      parts.length > 0
        ? `New Gmail: ${messages.length} message(s) — ${parts.join("; ")}`
        : `New Gmail activity (historyId ${historyId})`;

    await debouncer.enqueue({ eventDescription, messages, account, historyId });
  }

  return {
    id: "gmail",

    register(app: FastifyInstance): void {
      const inboundToken = process.env["GMAIL_INBOUND_TOKEN"];

      app.post<{ Querystring: { token?: string }; Body: GmailHookPayload }>(
        "/inbound/gmail",
        async (request, reply) => {
          if (inboundToken) {
            const provided =
              (request.headers["x-gog-token"] as string | undefined) ??
              (request.query as { token?: string }).token;
            if (provided !== inboundToken) {
              return reply.status(401).send({ error: "unauthorized" });
            }
          }

          const body = (request.body ?? {}) as GmailHookPayload;
          const messages = body.messages ?? [];
          request.log.info({ account: body.account, count: messages.length }, "gmail webhook received");

          try {
            await handleWebhook(body);
          } catch (err) {
            request.log.error({ err, account: body.account }, "gmail webhook enqueue failed");
          }

          return reply.status(200).send({ ok: true, received: messages.length });
        }
      );
    },

    async start(): Promise<void> {
      // Webhook-driven — nothing to do on start
    },

    async stop(): Promise<void> {
      // Debouncer flushes in-flight; no explicit teardown needed
    },
  };
}
