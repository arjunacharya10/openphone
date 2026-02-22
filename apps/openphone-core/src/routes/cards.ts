import type { FastifyPluginAsync } from "fastify";
import {
  getActiveCards,
  getCardById,
  createCard,
  actOnCard,
} from "../services/store.js";

const cardRoutes: FastifyPluginAsync = async (app) => {
  // Fetch active cards sorted by priority
  app.get("/cards", async () => {
    return getActiveCards();
  });

  // Fetch a single card by id (including non-active)
  app.get<{ Params: { id: string } }>("/cards/:id", async (request, reply) => {
    const card = getCardById(request.params.id);
    if (!card) {
      return reply.status(404).send({ error: "card not found" });
    }
    return card;
  });

  // Create a new card (for agent/external integration)
  app.post<{
    Body: {
      type: "email" | "calendar" | "system";
      title: string;
      context?: string;
      priority?: "low" | "medium" | "high";
      actions?: Array<{ label: string; action: string }>;
      sourceType?: string;
      sourceId?: string;
    };
  }>("/cards", async (request, reply) => {
    const { type, title, context, priority, actions, sourceType, sourceId } =
      request.body;

    if (!type || !title) {
      return reply.status(400).send({ error: "type and title are required" });
    }

    const card = createCard({
      type,
      title,
      context,
      priority,
      actions,
      sourceType,
      sourceId,
    });

    return reply.status(201).send(card);
  });

  // Handle user action on a card
  app.post<{
    Params: { id: string };
    Body: { action: string };
  }>("/cards/:id/action", async (request, reply) => {
    const { id } = request.params;
    const { action } = request.body;

    if (!action) {
      return reply.status(400).send({ error: "action is required" });
    }

    const card = actOnCard(id, action);
    if (!card) {
      return reply.status(404).send({ error: "card not found or not active" });
    }

    return { ok: true, cardId: id, action };
  });
};

export default cardRoutes;
