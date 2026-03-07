import type { FastifyInstance } from "fastify";
import type { ConversationChannel } from "../traits.js";
import { dispatchStreamingTurn } from "../../gateway/dispatch.js";
import { buildWhatsAppSessionKey } from "../../gateway/session-key.js";
import { subscribe } from "../../lib/event-bus.js";

/**
 * WhatsApp conversation channel via Baileys (WhatsApp Web protocol).
 *
 * The user sends WhatsApp messages to the paired number; the agent responds.
 * On first run, scan the QR code printed to stdout (or fetch from GET /api/whatsapp/qr).
 * Auth state persists in data/whatsapp-auth/ across restarts.
 *
 * Proactive notifications: when a card is created, a summary is sent to the
 * WHATSAPP_OWNER_JID (e.g. "15551234567@s.whatsapp.net") if configured.
 *
 * Required env:
 *   WHATSAPP_OWNER_JID  — your personal JID for proactive notifications (optional)
 *
 * Session key: agent:main:whatsapp:{phone} (e.g. agent:main:whatsapp:15551234567)
 */
export function createWhatsAppChannel(): ConversationChannel {
  let currentQr: string | null = null;
  // Lazily imported to avoid crashing if baileys is not installed
  let sock: Awaited<ReturnType<typeof connectBaileys>> | null = null;

  return {
    id: "whatsapp",

    register(app: FastifyInstance): void {
      // Expose QR code for pairing UI / scripts
      app.get("/api/whatsapp/qr", async (_request, reply) => {
        if (!currentQr) {
          return reply.status(204).send();
        }
        return reply.send({ qr: currentQr });
      });

      // Status endpoint
      app.get("/api/whatsapp/status", async (_request, reply) => {
        return reply.send({ connected: sock !== null, qrPending: currentQr !== null });
      });
    },

    async start(): Promise<void> {
      sock = await connectBaileys(
        (qr) => { currentQr = qr; },
        () => { currentQr = null; sock = null; },
        async (jid: string, text: string, logger: SimpleLogger) => {
          const phone = jidToPhone(jid);
          const sessionKey = buildWhatsAppSessionKey(phone);
          try {
            const result = await dispatchStreamingTurn({
              sessionKey,
              message: text,
              source: "whatsapp",
              onDelta: () => {}, // WhatsApp doesn't support streaming; collect full response
            });
            if (result.text) {
              await sock?.sendMessage(jid, { text: result.text });
            }
          } catch (err) {
            logger.error({ err, sessionKey }, "whatsapp agent turn failed");
          }
        }
      );

      // Subscribe to state events for proactive owner notifications
      const ownerJid = process.env["WHATSAPP_OWNER_JID"];
      if (ownerJid) {
        subscribe((event) => {
          if (!sock) return;
          if (event.type === "card:created") {
            const text = `New item needs your attention: ${event.payload.title}${event.payload.context ? `\n${event.payload.context.slice(0, 200)}` : ""}`;
            void sock.sendMessage(ownerJid, { text }).catch(() => {});
          }
        });
      }
    },

    async stop(): Promise<void> {
      await sock?.end(new Error("shutdown"));
      sock = null;
    },
  };
}

type SimpleLogger = { error(obj: object, msg: string): void };
type MessageHandler = (jid: string, text: string, logger: SimpleLogger) => Promise<void>;

async function connectBaileys(
  onQr: (qr: string) => void,
  onDisconnect: () => void,
  onMessage: MessageHandler
) {
  // Dynamic import so the module loads even if baileys is not yet installed.
  // If missing, this throws at runtime (not at startup) with a clear error.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baileys: any = await import("@whiskeysockets/baileys" as string).catch(() => {
    throw new Error(
      "WhatsApp channel requires @whiskeysockets/baileys. Run: npm install @whiskeysockets/baileys"
    );
  });

  const makeWASocket = baileys.default ?? baileys.makeWASocket;
  const { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = baileys;

  const { state, saveCreds } = await useMultiFileAuthState("data/whatsapp-auth");
  const { version } = await fetchLatestBaileysVersion();

  const logger: SimpleLogger = {
    error: (obj, msg) => console.error("[whatsapp]", msg, obj),
  };

  // Baileys expects a pino-like logger; silence it with a stub
  const silentLogger = {
    level: "silent",
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {},
    child: function() { return this; },
  };

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: silentLogger as never,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update: Record<string, unknown>) => {
    const { connection, lastDisconnect, qr } = update as {
      connection?: string;
      lastDisconnect?: { error: unknown };
      qr?: string;
    };

    if (qr) {
      onQr(qr);
    }

    if (connection === "close") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log("[whatsapp] connection closed, reconnect:", shouldReconnect);

      if (shouldReconnect) {
        // Reconnect after a short delay
        setTimeout(() => {
          void connectBaileys(onQr, onDisconnect, onMessage);
        }, 5000);
      } else {
        onDisconnect();
      }
    } else if (connection === "open") {
      console.log("[whatsapp] connected");
    }
  });

  sock.ev.on(
    "messages.upsert",
    async ({ messages, type }: { messages: Array<Record<string, unknown>>; type: string }) => {
      if (type !== "notify") return;

      for (const msg of messages) {
        // Skip messages sent by us
        if ((msg.key as { fromMe?: boolean })?.fromMe) continue;

        const jid = (msg.key as { remoteJid?: string })?.remoteJid;
        if (!jid) continue;

        // Extract text from various message types
        const text =
          (msg.message as { conversation?: string })?.conversation ??
          (msg.message as { extendedTextMessage?: { text?: string } })
            ?.extendedTextMessage?.text ??
          "";

        if (!text.trim()) continue;

        await onMessage(jid, text, logger);
      }
    }
  );

  return sock;
}

function jidToPhone(jid: string): string {
  return jid.split("@")[0] ?? jid;
}
