import type { FastifyPluginAsync } from "fastify";
import type { Integration } from "../api/types.js";
import { registry } from "../channels/registry.js";

const integrationsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: Integration[] }>("/api/integrations", async (_request, reply) => {
    const channels = registry.list();

    const integrations: Integration[] = channels.map(({ id, type }) => {
      const descriptions: Record<string, string> = {
        gmail: "Gmail inbound via gogcli watch serve",
        voice: "Voice conversation channel (WebSocket, STT on-device)",
        whatsapp: "WhatsApp conversation channel via Baileys",
        outlook: "Outlook inbound via Microsoft Graph webhooks",
        slack: "Slack workspace inbound via Events API",
      };
      return {
        name: id,
        description: descriptions[id] ?? `${type} channel: ${id}`,
        status: "active" as const,
      };
    });

    return reply.send(integrations);
  });
};

export default integrationsRoutes;
