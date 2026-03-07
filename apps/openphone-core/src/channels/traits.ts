import type { FastifyInstance } from "fastify";

export type Logger = {
  info(obj: object, msg: string): void;
  error(obj: object, msg: string): void;
  warn(obj: object, msg: string): void;
};

/**
 * Ingest channel — external data source the AI monitors.
 * The AI reads events and can respond *within* the channel (e.g. reply to an email),
 * but the user does not initiate conversations here.
 *
 * Lifecycle:
 *   register(app) → called before app.listen() to mount webhook routes
 *   start()       → called after listen(); for polling channels, start timers here
 *   stop()        → graceful shutdown
 */
export interface IngestChannel {
  readonly id: string;
  register(app: FastifyInstance): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Conversation channel — bidirectional user ↔ AI communication.
 * The user talks to the AI through this channel; the AI responds here.
 *
 * Lifecycle:
 *   register(app) → called before listen() to mount WS/HTTP routes
 *   start()       → called after listen(); connect to external services (e.g. WhatsApp)
 *   stop()        → graceful shutdown
 */
export interface ConversationChannel {
  readonly id: string;
  register(app: FastifyInstance): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}
