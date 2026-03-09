export type DispatchSource = "gmail" | "voice" | "whatsapp" | string;

/**
 * Normalized text message that should be routed to the agent runtime.
 * Channel adapters convert their native payloads into this shape.
 */
export interface InboundMessage {
  /** Fully-qualified session key (usually agent-scoped, e.g. agent:main:gmail:account). */
  sessionKey: string;
  /** User-visible text or event description to feed into the agent. */
  body: string;
  /** Logical source of the message (gmail, ui, etc.). */
  source: DispatchSource;
  /** Optional extra metadata for logging or future routing. */
  metadata?: Record<string, unknown>;
}

/**
 * Minimal channel adapter contract: turn a raw payload into one or more
 * normalized inbound messages for the gateway to dispatch.
 */
export interface ChannelAdapter<TPayload = unknown> {
  channelId: string;
  ingest(payload: TPayload): Promise<InboundMessage[]>;
}

