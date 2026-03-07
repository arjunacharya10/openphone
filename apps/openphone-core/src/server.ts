import "dotenv/config";
import Fastify from "fastify";
import websocket from "@fastify/websocket";

// Routes
import healthRoutes from "./routes/health.js";
import statusRoutes from "./routes/status.js";
import cardRoutes from "./routes/cards.js";
import chatRoutes from "./routes/chat.js";
import cronRoutes from "./routes/cron.js";
import pairRoutes from "./routes/pair.js";
import toolsRoutes from "./routes/tools.js";
import integrationsRoutes from "./routes/integrations.js";
import diagRoutes from "./routes/diag.js";
import configRoutes from "./routes/config.js";
import memoryRoutes from "./routes/memory.js";

// Channels
import { registry } from "./channels/registry.js";
import { createGmailIngestChannel } from "./channels/ingest/gmail.js";
import { createVoiceChannel } from "./channels/conversation/voice.js";
import { createWhatsAppChannel } from "./channels/conversation/whatsapp.js";

// Auth
import { requireAuth } from "./auth/middleware.js";
import { seedDemoData } from "./services/store.js";

const PORT = Number(process.env.PORT) || 3000;

const app = Fastify({ logger: true });

app.addHook("preHandler", requireAuth);
await app.register(websocket);

// ── Register routes ──
await app.register(healthRoutes);
await app.register(statusRoutes);
await app.register(cardRoutes);
await app.register(chatRoutes);
await app.register(cronRoutes);
await app.register(pairRoutes);
await app.register(toolsRoutes);
await app.register(integrationsRoutes);
await app.register(diagRoutes);
await app.register(configRoutes);
await app.register(memoryRoutes);

// ── Register channels (mounts routes before listen()) ──
const logger = {
  info: (obj: object, msg: string) => app.log.info(obj, msg),
  error: (obj: object, msg: string) => app.log.error(obj, msg),
  warn: (obj: object, msg: string) => app.log.warn(obj, msg),
};

// Ingest: external data sources the AI monitors
registry.registerIngest(createGmailIngestChannel(logger), app);
// Future ingest: registry.registerIngest(createOutlookIngestChannel(logger), app);
// Future ingest: registry.registerIngest(createSlackIngestChannel(logger), app);

// Conversation: channels the user talks to the AI through
registry.registerConversation(createVoiceChannel(), app);
if (process.env.WHATSAPP_ENABLED === "true") {
  registry.registerConversation(createWhatsAppChannel(), app);
}

// ── Startup tasks ──
const { isGraphitiAvailable } = await import("./graph/client.js");

isGraphitiAvailable().then((ok) => {
  if (ok) {
    app.log.info("graphiti-service: connected");
  } else {
    app.log.warn("graphiti-service: unavailable — KG memory disabled (start apps/graphiti-service)");
  }
});

const { startCronScheduler } = await import("./cron/scheduler.js");
startCronScheduler();
app.log.info("Cron scheduler started");

seedDemoData();

// ── Listen, then start channels requiring external connections (e.g. WhatsApp) ──
app.listen({ port: PORT, host: "0.0.0.0" }, async (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`openphone-core listening at ${address}`);

  try {
    await registry.startAll();
    app.log.info("All channels started");
  } catch (startErr) {
    app.log.error(startErr, "Channel startup failed");
  }
});

// ── Graceful shutdown ──
async function shutdown() {
  app.log.info("Shutting down");
  await registry.stopAll();
  await app.close();
}

process.on("SIGTERM", () => void shutdown().then(() => process.exit(0)));
process.on("SIGINT", () => void shutdown().then(() => process.exit(0)));
