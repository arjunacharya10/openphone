import type { FastifyPluginAsync } from "fastify";
import { addClient, removeClient, send, broadcast } from "../lib/broadcast.js";
import {
  getActiveCards,
  getLedger,
  getCalendarEvents,
  actOnCard,
  getCardById,
} from "../services/store.js";
import { runAgentTurnStream } from "../agent/loop.js";
import {
  getSessionHistory,
  setSessionHistory,
  withSessionLock,
} from "../agent/sessions.js";

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
          const { message, cardId } = event.payload as {
            message: string;
            cardId?: string;
          };
          request.log.info({ message, cardId }, "Chat message received");

          const sessionKey = cardId
            ? `ui:chat:${cardId}`
            : "ui:chat:general";

          const card = cardId ? getCardById(cardId) : undefined;
          const cardContext = card
            ? { title: card.title, context: card.context }
            : undefined;
          const turnContext = cardId
            ? { cardId, cardTitle: card?.title }
            : undefined;

          withSessionLock(sessionKey, async () => {
            const history = getSessionHistory(sessionKey);
            const result = await runAgentTurnStream(
              {
                sessionKey,
                message,
                history,
                cardContext,
                turnContext,
              },
              (delta) => {
                broadcast({
                  type: "chat:delta",
                  payload: { delta, sessionKey },
                  timestamp: Date.now(),
                });
              }
            );
            setSessionHistory(sessionKey, result.history);
            // Always broadcast so streamed content is replaced (avoids residual text when extraction yields empty)
            broadcast({
              type: "chat:response",
              payload: { text: result.text ?? "", sessionKey },
              timestamp: Date.now(),
            });
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
