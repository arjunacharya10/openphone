import type { FastifyRequest, FastifyReply } from "fastify";
import { validateToken } from "./pairing.js";

/** Paths that do not require auth (public). */
const PUBLIC_PATHS = new Set([
  "/health",
  "/api/status",
  "/api/health",
  "/api/tools",
  "/api/integrations",
  "/api/diag",
  "/pair",
  "/pair/code",
]);

/**
 * Fastify preHandler that requires Bearer token for protected /api/* and /pair/* routes.
 * Skips check for public paths and when LAURA_REQUIRE_PAIRING is not set (auth disabled).
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const path = request.url.split("?")[0] ?? request.url;
  if (PUBLIC_PATHS.has(path)) {
    return;
  }
  const requirePairing = process.env["LAURA_REQUIRE_PAIRING"] === "true";
  if (!requirePairing) {
    return;
  }
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  if (!validateToken(token)) {
    await reply.status(401).send({ error: "unauthorized" });
  }
}
