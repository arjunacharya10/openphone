import type { FastifyPluginAsync } from "fastify";
import type { ConfigResponse } from "../api/types.js";
import { getConfigContent, setConfigContent } from "../config/index.js";

interface PutConfigBody {
  format?: "json";
  content: string;
}

const configRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: ConfigResponse }>("/api/config", async (_request, reply) => {
    const content = await getConfigContent();
    return reply.send({ format: "json", content });
  });

  app.put<{ Body: PutConfigBody }>("/api/config", async (request, reply) => {
    const body = request.body as PutConfigBody;
    if (!body?.content || typeof body.content !== "string") {
      return reply.status(400).send({ error: "content (string) required" });
    }
    try {
      JSON.parse(body.content);
    } catch {
      return reply.status(400).send({ error: "invalid JSON" });
    }
    await setConfigContent(body.content);
    const content = await getConfigContent();
    return reply.send({ format: "json", content });
  });
};

export default configRoutes;
