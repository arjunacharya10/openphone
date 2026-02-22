import type { FastifyPluginAsync } from "fastify";
import { runInboundTurn } from "../agent/loop.js";

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

const inboundRoutes: FastifyPluginAsync = async (app) => {
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

    const body = (request.body ?? {}) as GmailHookPayload;
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

    const sessionKey = `gmail:${account}:${historyId}`;

    runInboundTurn(eventDescription, sessionKey)
      .then((result) => {
        request.log.info(
          { sessionKey, toolCallCount: result.toolCallCount },
          "Inbound Gmail agent turn completed"
        );
      })
      .catch((err) => {
        request.log.error({ err, sessionKey }, "Inbound Gmail agent turn failed");
      });

    return reply.status(200).send({ ok: true, received: messages.length });
  });
};

export default inboundRoutes;
