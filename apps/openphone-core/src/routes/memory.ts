import type { FastifyPluginAsync } from "fastify";
import { searchGraph } from "../graph/client.js";
import { deleteFact, getFacts, setFact } from "../memory/facts.js";
import { openMemoryDb, ensureMemorySchema } from "../memory/schema.js";
import { isGraphitiAvailable } from "../graph/client.js";

const memoryRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/memory/status", async (_request, reply) => {
    const db = openMemoryDb();
    ensureMemorySchema(db);
    const factsCount = (db.prepare("SELECT COUNT(*) as c FROM facts").get() as { c: number }).c;
    db.close();
    const graphiti = await isGraphitiAvailable();
    return reply.send({
      factsCount,
      graphiti,
      graphitiUrl: process.env["GRAPHITI_SERVICE_URL"] ?? "http://localhost:7473",
    });
  });

  // Proxy KG search through the control plane so the CLI works unchanged
  app.get<{ Querystring: { q?: string } }>("/api/memory/search", async (request, reply) => {
    const q = request.query.q?.trim();
    if (!q) return reply.status(400).send({ error: "query parameter 'q' required" });
    const results = await searchGraph(q);
    return reply.send(results);
  });

  app.get("/api/memory/facts", async (_request, reply) => {
    return reply.send(getFacts());
  });

  app.post<{ Body: { key: string; value: string } }>("/api/memory/facts", async (request, reply) => {
    const { key, value } = request.body;
    if (!key || !value) return reply.status(400).send({ error: "key and value required" });
    setFact(key, value, "api");
    return reply.status(201).send({ key, value });
  });

  app.delete<{ Params: { key: string } }>("/api/memory/facts/:key", async (request, reply) => {
    deleteFact(request.params.key);
    return reply.status(204).send();
  });
};

export default memoryRoutes;
