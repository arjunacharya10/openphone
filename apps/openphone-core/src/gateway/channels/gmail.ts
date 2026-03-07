import {
  createInboundDebouncer,
  runSerializedForKey,
  createSemaphore,
} from "../../inbound/index.js";
import type { InboundMessage } from "../types.js";
import { buildGmailSessionKey } from "../session-key.js";
import { dispatchInboundMessage } from "../dispatch.js";
import { setLastGmailInboundAt } from "../../status/inbound-state.js";

type Logger = {
  info: (o: object, s: string) => void;
  error: (o: object, s: string) => void;
};

export interface GmailMessage {
  id?: string;
  threadId?: string;
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  snippet?: string;
  body?: string;
  bodyTruncated?: boolean;
  labels?: string[];
}

export interface GmailHookPayload {
  source?: string;
  account?: string;
  historyId?: string;
  deletedMessageIds?: string[];
  messages?: GmailMessage[];
}

interface GmailInboundItem {
  eventDescription: string;
  messages: GmailMessage[];
  account: string;
  historyId: string;
}

const DEBOUNCE_MS = Number(process.env["INBOUND_DEBOUNCE_MS"]) || 500;
const MAX_CONCURRENT_INBOUND =
  Number(process.env["INBOUND_MAX_CONCURRENT"]) || 5;

/**
 * Gmail channel adapter.
 *
 * - Debounces high-frequency webhook events per account
 * - Serializes per-account processing
 * - Dispatches combined summaries to the agent via the gateway
 */
export function createGmailChannel(logger: Logger) {
  const inboundSemaphore = createSemaphore(MAX_CONCURRENT_INBOUND);

  const gmailDebouncer = createInboundDebouncer<GmailInboundItem>({
    debounceMs: DEBOUNCE_MS,
    buildKey: (item) => (item.account ? `gmail:${item.account}` : null),
    onFlush: async (items) => {
      if (items.length === 0) return;
      const account = items[0].account;
      logger.info(
        { msg: "Gmail debouncer flush", count: items.length, account },
        "gmail.debouncer.flush"
      );

      const combinedDescription =
        items.length === 1
          ? items[0].eventDescription
          : items
              .map((i) => i.eventDescription)
              .filter(Boolean)
              .join(" | ");

      const sessionKey = buildGmailSessionKey(account);
      const queueKey = `gmail:${account}`;

      await runSerializedForKey(queueKey, async () => {
        logger.info(
          {
            msg: "About to run Gmail agent turn",
            sessionKey,
            eventDescription: combinedDescription.slice(0, 80),
          },
          "gmail.agent.start"
        );
        await inboundSemaphore.acquire();
        try {
          const inbound: InboundMessage = {
            sessionKey,
            body: combinedDescription,
            source: "gmail",
            metadata: {
              account,
              historyId: items[0]?.historyId,
              itemCount: items.length,
            },
          };
          const result = await dispatchInboundMessage(inbound);
          setLastGmailInboundAt();
          logger.info(
            { sessionKey, toolCallCount: result.toolCallCount },
            "Inbound Gmail agent turn completed"
          );
        } catch (err) {
          logger.error(
            { err, sessionKey },
            "Inbound Gmail agent turn failed"
          );
        } finally {
          inboundSemaphore.release();
        }
      });
    },
    onError: (err, items) => {
      logger.error(
        { err, account: items[0]?.account },
        "Inbound Gmail debouncer flush error"
      );
    },
  });

  async function handleWebhook(payload: GmailHookPayload): Promise<void> {
    const messages = payload.messages ?? [];
    const account = payload.account ?? "unknown";
    const historyId = payload.historyId ?? "";

    const parts: string[] = [];
    for (const m of messages.slice(0, 10)) {
      const subj = m.subject ?? "(no subject)";
      const from = m.from ?? "unknown";
      parts.push(`"${subj}" from ${from}`);
    }
    const eventDescription =
      parts.length > 0
        ? `New Gmail: ${messages.length} message(s) — ${parts.join("; ")}`
        : `New Gmail activity (historyId ${historyId})`;

    const item: GmailInboundItem = {
      eventDescription,
      messages,
      account,
      historyId,
    };

    await gmailDebouncer.enqueue(item);
  }

  return {
    handleWebhook,
  };
}

