import Fastify from "fastify";

const PORT = Number(process.env.PORT) || 3000;

const app = Fastify({ logger: true });

app.get("/health", async () => {
  return { status: "ok" };
});

app.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`openphone-core listening at ${address}`);
});
