import "dotenv/config";
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import healthRoutes from "./routes/health.js";
import statusRoutes from "./routes/status.js";
import cardRoutes from "./routes/cards.js";
import chatRoutes from "./routes/chat.js";
import wsRoutes from "./routes/ws.js";
import inboundRoutes from "./routes/inbound.js";
import cronRoutes from "./routes/cron.js";
import pairRoutes from "./routes/pair.js";
import toolsRoutes from "./routes/tools.js";
import integrationsRoutes from "./routes/integrations.js";
import diagRoutes from "./routes/diag.js";
import configRoutes from "./routes/config.js";
import memoryRoutes from "./routes/memory.js";
import { requireAuth } from "./auth/middleware.js";
import { seedDemoData } from "./services/store.js";

const PORT = Number(process.env.PORT) || 3000;

const app = Fastify({ logger: true });

app.addHook("preHandler", requireAuth);
await app.register(websocket);
await app.register(healthRoutes);
await app.register(statusRoutes);
await app.register(cardRoutes);
await app.register(chatRoutes);
await app.register(wsRoutes);
await app.register(inboundRoutes);
await app.register(cronRoutes);
await app.register(pairRoutes);
await app.register(toolsRoutes);
await app.register(integrationsRoutes);
await app.register(diagRoutes);
await app.register(configRoutes);
await app.register(memoryRoutes);

// Memory: sync on startup, start watcher
const { syncFiles } = await import("./memory/sync.js");
const { startMemoryWatcher } = await import("./memory/watcher.js");
syncFiles("startup").catch((err) => app.log.warn(err, "memory sync on startup failed"));
startMemoryWatcher();

// Start cron scheduler
const { startCronScheduler } = await import("./cron/scheduler.js");
startCronScheduler();
app.log.info("Cron scheduler started");

// Seed demo data for development
seedDemoData();
app.log.info("Demo data seeded");

app.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`openphone-core listening at ${address}`);
});
