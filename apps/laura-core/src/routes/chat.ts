import type { FastifyPluginAsync } from "fastify";
import { getSessionHistory } from "../agent/sessions.js";

const chatRoutes: FastifyPluginAsync = async (app) => {
  app.get<{
    Params: { sessionKey: string };
  }>("/chat/session/:sessionKey/history", async (request, reply) => {
    const { sessionKey } = request.params;
    const decoded = decodeURIComponent(sessionKey);
    const messages = getSessionHistory(decoded);
    return { messages };
  });
};

export default chatRoutes;
