import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import type { ConversationChannel } from "../traits.js";
import { dispatchStreamingTurn } from "../../gateway/dispatch.js";
import { buildVoiceSessionKey } from "../../gateway/session-key.js";
import { ingestSessionHistory } from "../../graph/ingest.js";
import { subscribe } from "../../lib/event-bus.js";

/**
 * Voice conversation channel.
 *
 * Designed for wearables (e.g. Meta Ray-Ban style glasses) where the client
 * performs STT on-device and sends plain text. The server streams the agent
 * response back as text deltas; the client performs TTS locally.
 *
 * Protocol (WebSocket at /ws/voice):
 *   Client → Server:  { type: "voice:message", text: "...", deviceId?: "..." }
 *   Server → Client:  { type: "voice:delta",   text: "..." }   (streamed chunks)
 *   Server → Client:  { type: "voice:done",    text: "..." }   (full response)
 *   Server → Client:  { type: "voice:error",   error: "..." }
 *
 * State notifications (proactive, from event bus):
 *   Server → Client:  { type: "notify:card",   title: "...", summary: "..." }
 *   Server → Client:  { type: "notify:ingest", channel: "...", summary: "..." }
 *
 * Session key: agent:main:voice:{deviceId}
 * If no deviceId is provided, the session is ephemeral (per-connection UUID).
 */
export function createVoiceChannel(): ConversationChannel {
  return {
    id: "voice",

    register(app: FastifyInstance): void {
      app.get("/ws/voice", { websocket: true }, (socket: WebSocket, request) => {
        const deviceId =
          ((request.query as Record<string, string>)["deviceId"] ?? "").trim() ||
          crypto.randomUUID();

        const sessionKey = buildVoiceSessionKey(deviceId);
        request.log.info({ deviceId, sessionKey }, "voice client connected");

        // Subscribe to state events and surface them proactively
        const unsub = subscribe((event) => {
          if (socket.readyState !== 1) return;
          if (event.type === "card:created") {
            send(socket, {
              type: "notify:card",
              title: event.payload.title,
              summary: event.payload.context?.slice(0, 120) ?? "",
            });
          } else if (event.type === "ingest:received") {
            send(socket, {
              type: "notify:ingest",
              channel: event.payload.channel,
              summary: event.payload.summary,
            });
          }
        });

        socket.on("message", (raw: Buffer) => {
          let event: { type: string; text?: string; deviceId?: string };
          try {
            event = JSON.parse(raw.toString());
          } catch {
            send(socket, { type: "voice:error", error: "invalid json" });
            return;
          }

          if (event.type !== "voice:message" || !event.text?.trim()) {
            return;
          }

          void (async () => {
            try {
              const result = await dispatchStreamingTurn({
                sessionKey,
                message: event.text!,
                source: "voice",
                onDelta: (delta) => {
                  send(socket, { type: "voice:delta", text: delta });
                },
              });
              send(socket, { type: "voice:done", text: result.text ?? "" });
            } catch (err) {
              request.log.error({ err, sessionKey }, "voice agent turn failed");
              send(socket, { type: "voice:error", error: "agent error" });
            }
          })();
        });

        socket.on("close", () => {
          unsub();
          ingestSessionHistory(sessionKey, "voice");
          request.log.info({ deviceId }, "voice client disconnected");
        });
      });
    },

    async start(): Promise<void> {
      // Route-driven — nothing async to start
    },

    async stop(): Promise<void> {
      // Connections are closed when the server closes
    },
  };
}

function send(socket: WebSocket, payload: Record<string, unknown>): void {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(payload));
  }
}
