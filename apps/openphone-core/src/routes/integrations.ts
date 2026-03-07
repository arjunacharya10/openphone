import type { FastifyPluginAsync } from "fastify";
import type { Integration } from "../api/types.js";

const integrationsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: Integration[] }>("/api/integrations", async (_request, reply) => {
    const integrations: Integration[] = [
      {
        name: "gmail",
        description: "Gmail inbound via gogcli watch serve",
        status: process.env["GMAIL_INBOUND_TOKEN"] ? "active" : "available",
      },
      {
        name: "ui",
        description: "WebSocket chat from openphone-ui",
        status: "active",
      },
    ];
    return reply.send(integrations);
  });
};

export default integrationsRoutes;
