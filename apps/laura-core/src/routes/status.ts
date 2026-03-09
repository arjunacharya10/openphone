import type { FastifyPluginAsync } from "fastify";
import { getStatusResponse } from "../status/aggregator.js";
import { getHealthSnapshot } from "../status/health.js";

const statusRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/status", async (_request, reply) => {
    const status = await getStatusResponse();
    return reply.send(status);
  });

  app.get("/api/health", async (_request, reply) => {
    const health = getHealthSnapshot();
    return reply.send(health);
  });
};

export default statusRoutes;
