import type { FastifyPluginAsync } from "fastify";
import { runInboundTurn } from "../agent/loop.js";
import {
  createInboundDebouncer,
  runSerializedForKey,
  createSemaphore,
} from "../inbound/index.js";

interface GmailMessage {
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

interface GmailHookPayload {
  source?: string;
  account?: string;
  historyId?: string;
  deletedMessageIds?: string[];
  messages?: GmailMessage[];
}

export interface GmailInboundItem {
  eventDescription: string;
  messages: GmailMessage[];
  account: string;
  historyId: string;
}

const DEBOUNCE_MS = Number(process.env["INBOUND_DEBOUNCE_MS"]) || 500;
const MAX_CONCURRENT_INBOUND =
  Number(process.env["INBOUND_MAX_CONCURRENT"]) || 5;

const inboundSemaphore = createSemaphore(MAX_CONCURRENT_INBOUND);

let inboundLogger: { info: (o: object, s: string) => void; error: (o: object, s: string) => void } = {
  info: () => {},
  error: () => {},
};

const gmailDebouncer = createInboundDebouncer<GmailInboundItem>({
  debounceMs: DEBOUNCE_MS,
  buildKey: (item) => (item.account ? `gmail:${item.account}` : null),
  onFlush: async (items) => {
    if (items.length === 0) return;
    inboundLogger.info({ msg: "Reached here: debouncer flush", count: items.length, account: items[0]?.account });
    const account = items[0].account;
    const key = `gmail:${account}`;
    const combinedDescription =
      items.length === 1
        ? items[0].eventDescription
        : items
            .map((i) => i.eventDescription)
            .filter(Boolean)
            .join(" | ");
    const sessionKey = `gmail:${account}`;

    await runSerializedForKey(key, async () => {
      inboundLogger.info({ msg: "Reached here: about to run agent", sessionKey, eventDescription: combinedDescription.slice(0, 80) });
      await inboundSemaphore.acquire();
      try {
        const result = await runInboundTurn(combinedDescription, sessionKey);
        inboundLogger.info(
          { sessionKey, toolCallCount: result.toolCallCount },
          "Inbound Gmail agent turn completed"
        );
      } catch (err) {
        inboundLogger.error({ err, sessionKey }, "Inbound Gmail agent turn failed");
      } finally {
        inboundSemaphore.release();
      }
    });
  },
  onError: (err, items) => {
    inboundLogger.error(
      { err, account: items[0]?.account },
      "Inbound Gmail debouncer flush error"
    );
  },
});

const inboundRoutes: FastifyPluginAsync = async (app) => {
  inboundLogger = requestLogger(app);

  app.post<{
    Querystring: { token?: string };
    Body: GmailHookPayload;
  }>("/inbound/gmail", async (request, reply) => {
    const token = process.env["GMAIL_INBOUND_TOKEN"];
    if (token) {
      const headerToken = request.headers["x-gog-token"];
      const queryToken = (request.query as { token?: string }).token;
      const provided = headerToken ?? queryToken;
      if (provided !== token) {
        return reply.status(401).send({ error: "unauthorized" });
      }
    }

    request.log.info({ msg: "Reached here: POST /inbound/gmail" });
    const body = (request.body ?? {}) as GmailHookPayload;
    request.log.info({ msg: "Payload:", account: body.account, historyId: body.historyId, messagesCount: (body.messages ?? []).length });
    const messages = body.messages ?? [];
    const account = body.account ?? "unknown";
    const historyId = body.historyId ?? "";

    const parts: string[] = [];
    for (const m of messages.slice(0, 10)) {
      const subj = m.subject ?? "(no subject)";
      const from = m.from ?? "unknown";
      parts.push(`"${subj}" from ${from}`);
    }
    const eventDescription =
      parts.length > 0
        ? `New Gmail: ${messages.length} message(s) — ${parts.join("; ")}`
        : `New Gmail activity (historyId ${historyId})`;

    const item: GmailInboundItem = {
      eventDescription,
      messages,
      account,
      historyId,
    };

    gmailDebouncer.enqueue(item).catch((err) => {
      request.log.error({ err, account }, "Inbound Gmail enqueue failed");
    });

    return reply.status(200).send({ ok: true, received: messages.length });
  });
};

function requestLogger(app: {
  log: { info: (o: object, s: string) => void; error: (o: object, s: string) => void };
}) {
  return {
    info: (o: object, s: string) => app.log.info(o, s),
    error: (o: object, s: string) => app.log.error(o, s),
  };
}

export default inboundRoutes;
