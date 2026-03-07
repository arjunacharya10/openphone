import type { FastifyPluginAsync } from "fastify";
import { createEmbeddingProvider } from "../memory/embeddings.js";
import { search } from "../memory/search.js";
import { ensureMemorySchema, openMemoryDb } from "../memory/schema.js";
import { syncFiles } from "../memory/sync.js";

const memoryRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/memory/status", async (_request, reply) => {
    const db = openMemoryDb();
    ensureMemorySchema(db);
    const files = (db.prepare("SELECT COUNT(*) as c FROM files").get() as { c: number }).c;
    const chunks = (db.prepare("SELECT COUNT(*) as c FROM chunks").get() as { c: number }).c;
    const provider = createEmbeddingProvider({});
    db.close();
    return reply.send({
      enabled: process.env["OPENPHONE_MEMORY_ENABLED"] !== "false",
      provider: provider ? "openai" : "none",
      model: provider?.model ?? null,
      filesIndexed: files,
      chunksIndexed: chunks,
      vectorAvailable: Boolean(provider),
      ftsAvailable: true,
    });
  });

  app.post("/api/memory/sync", async (_request, reply) => {
    const result = await syncFiles("manual");
    return reply.send(result);
  });

  app.get<{ Querystring: { q?: string } }>("/api/memory/search", async (request, reply) => {
    const q = request.query.q?.trim();
    if (!q) {
      return reply.status(400).send({ error: "query parameter 'q' required" });
    }
    const results = await search(q);
    return reply.send(results);
  });
};

export default memoryRoutes;
