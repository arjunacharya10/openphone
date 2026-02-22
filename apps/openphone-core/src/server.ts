import Fastify from "fastify";
import websocket from "@fastify/websocket";
import healthRoutes from "./routes/health.js";
import cardRoutes from "./routes/cards.js";
import chatRoutes from "./routes/chat.js";
import wsRoutes from "./routes/ws.js";
import inboundRoutes from "./routes/inbound.js";
import { seedDemoData } from "./services/store.js";

const PORT = Number(process.env.PORT) || 3000;

const app = Fastify({ logger: true });

await app.register(websocket);
await app.register(healthRoutes);
await app.register(cardRoutes);
await app.register(chatRoutes);
await app.register(wsRoutes);
await app.register(inboundRoutes);

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
