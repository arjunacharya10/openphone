import type { FastifyPluginAsync } from "fastify";
import { createGmailChannel, type GmailHookPayload } from "../gateway/channels/gmail.js";

const inboundRoutes: FastifyPluginAsync = async (app) => {
  const inboundLogger = requestLogger(app);
  const gmailChannel = createGmailChannel(inboundLogger);

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
    const messages = body.messages ?? [];
    request.log.info({
      msg: "Payload:",
      account: body.account,
      historyId: body.historyId,
      messagesCount: messages.length,
    });
    try {
      await gmailChannel.handleWebhook(body);
    } catch (err) {
      request.log.error(
        { err, account: body.account ?? "unknown" },
        "Inbound Gmail enqueue failed"
      );
      // Still return 200 so gogcli doesn't aggressively retry; errors are logged.
    }

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
