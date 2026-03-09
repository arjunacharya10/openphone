import type { FastifyPluginAsync } from "fastify";

interface DiagResult {
  severity: "ok" | "warn" | "error";
  category: string;
  message: string;
}

const diagRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: DiagResult[] }>("/api/diag", async (_request, reply) => {
    const results: DiagResult[] = [];
    const openrouterKey = process.env["OPENROUTER_API_KEY"];
    results.push({
      severity: openrouterKey ? "ok" : "warn",
      category: "llm",
      message: openrouterKey ? "OpenRouter API key configured" : "OpenRouter API key not set",
    });
    results.push({
      severity: "ok",
      category: "gateway",
      message: "Gateway layer active",
    });
    return reply.send(results);
  });
};

export default diagRoutes;
