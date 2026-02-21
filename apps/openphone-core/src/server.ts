import Fastify from "fastify";
import websocket from "@fastify/websocket";

const PORT = Number(process.env.PORT) || 3000;

const app = Fastify({ logger: true });

await app.register(websocket);

app.get("/health", async () => {
  return { status: "ok" };
});

app.get("/ws", { websocket: true }, (socket) => {
  const connected = JSON.stringify({
    type: "connected",
    payload: {},
    timestamp: Date.now(),
  });
  socket.send(connected);

  socket.on("message", (msg: Buffer) => {
    socket.send(msg.toString());
  });
});

app.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`openphone-core listening at ${address}`);
});
