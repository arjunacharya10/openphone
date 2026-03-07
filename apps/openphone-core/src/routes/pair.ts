import type { FastifyPluginAsync } from "fastify";
import {
  generatePairingCode,
  getPairingCode,
  pairWithCode,
  getPersistedToken,
} from "../auth/pairing.js";

const pairRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Get current pairing code (or generate one).
   * Intended for localhost/device UI; returns code to display to user.
   */
  app.get("/pair/code", async (_request, reply) => {
    let code = getPairingCode();
    if (!code) {
      code = generatePairingCode();
    }
    return reply.send({ code });
  });

  /**
   * Pair with a code. POST /pair with X-Pairing-Code header.
   * Returns { token } on success. Client stores token and uses Bearer auth.
   */
  app.post<{
    Headers: { "x-pairing-code"?: string };
    Reply: { token: string } | { error: string };
  }>("/pair", async (request, reply) => {
    const code =
      request.headers["x-pairing-code"] ??
      (request.headers["X-Pairing-Code"] as string | undefined);
    if (!code) {
      return reply.status(400).send({ error: "X-Pairing-Code header required" });
    }
    const token = pairWithCode(code);
    if (!token) {
      return reply.status(400).send({ error: "invalid or expired pairing code" });
    }
    return reply.send({ token });
  });
};

export default pairRoutes;
