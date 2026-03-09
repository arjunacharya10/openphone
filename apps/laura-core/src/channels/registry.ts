import type { FastifyInstance } from "fastify";
import type { IngestChannel, ConversationChannel } from "./traits.js";

interface ChannelEntry {
  id: string;
  type: "ingest" | "conversation";
  channel: IngestChannel | ConversationChannel;
}

class ChannelRegistry {
  private entries: ChannelEntry[] = [];

  /**
   * Register an ingest channel and mount its webhook routes.
   * Must be called before app.listen().
   */
  registerIngest(channel: IngestChannel, app: FastifyInstance): void {
    channel.register(app);
    this.entries.push({ id: channel.id, type: "ingest", channel });
  }

  /**
   * Register a conversation channel and mount its routes.
   * Must be called before app.listen().
   */
  registerConversation(channel: ConversationChannel, app: FastifyInstance): void {
    channel.register(app);
    this.entries.push({ id: channel.id, type: "conversation", channel });
  }

  /** Start all registered channels (call after app.listen()). */
  async startAll(): Promise<void> {
    for (const { channel } of this.entries) {
      await channel.start();
    }
  }

  /** Gracefully stop all channels. */
  async stopAll(): Promise<void> {
    for (const { channel } of [...this.entries].reverse()) {
      await channel.stop().catch(() => {});
    }
  }

  list(): Array<{ id: string; type: "ingest" | "conversation" }> {
    return this.entries.map(({ id, type }) => ({ id, type }));
  }

  getIngestChannel(id: string): IngestChannel | undefined {
    const entry = this.entries.find((e) => e.id === id && e.type === "ingest");
    return entry?.channel as IngestChannel | undefined;
  }
}

export const registry = new ChannelRegistry();
