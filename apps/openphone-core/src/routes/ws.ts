import type { FastifyPluginAsync } from "fastify";
import { addClient, removeClient, send, broadcast } from "../lib/broadcast.js";
import {
  getActiveCards,
  getLedger,
  getCalendarEvents,
  actOnCard,
} from "../services/store.js";
import { runAgentTurn } from "../agent/loop.js";

const wsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/ws", { websocket: true }, (socket, request) => {
    addClient(socket);
    request.log.info("WebSocket client connected");

    // Send initial state
    send(socket, {
      type: "connected",
      payload: {},
      timestamp: Date.now(),
    });

    send(socket, {
      type: "cards:sync",
      payload: getActiveCards(),
      timestamp: Date.now(),
    });

    send(socket, {
      type: "ledger:sync",
      payload: getLedger(),
      timestamp: Date.now(),
    });

    send(socket, {
      type: "calendar:sync",
      payload: getCalendarEvents(),
      timestamp: Date.now(),
    });

    // Handle incoming messages
    socket.on("message", (raw: Buffer) => {
      let event: { type: string; payload: Record<string, unknown> };

      try {
        event = JSON.parse(raw.toString());
      } catch {
        request.log.warn("Invalid JSON from WebSocket client");
        return;
      }

      switch (event.type) {
        case "card:action": {
          const { cardId, action } = event.payload as {
            cardId: string;
            action: string;
          };
          if (cardId && action) {
            actOnCard(cardId, action);
          }
          break;
        }

        case "chat:message": {
          const { message } = event.payload as { message: string };
          request.log.info({ message }, "Chat message received");

          // Run agent turn async — response broadcast back via action:recorded / card:created
          runAgentTurn({ sessionKey: "ui:chat", message }).then((result) => {
            if (result.text) {
              broadcast({
                type: "chat:response",
                payload: { text: result.text },
                timestamp: Date.now(),
              });
            }
          }).catch((err) => {
            request.log.error({ err }, "Agent turn failed");
          });
          break;
        }

        default:
          request.log.warn({ type: event.type }, "Unknown event type");
      }
    });

    socket.on("close", () => {
      removeClient(socket);
      request.log.info("WebSocket client disconnected");
    });
  });
};

export default wsRoutes;
