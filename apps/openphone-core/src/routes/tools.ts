import type { FastifyPluginAsync } from "fastify";
import { getToolSpecs } from "../agent/tools-introspection.js";

const toolsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/tools", async (_request, reply) => {
    const specs = getToolSpecs();
    return reply.send(specs);
  });
};

export default toolsRoutes;
