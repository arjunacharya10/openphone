import type { AgentTurnResult } from "../agent/loop.js";
import { runInboundTurn, runAgentTurnStream } from "../agent/loop.js";
import type { TurnContext } from "../agent/tools.js";
import { getSessionHistory, setSessionHistory, withSessionLock } from "../agent/sessions.js";
import type { InboundMessage, DispatchSource } from "./types.js";
import { normalizeToAgentSessionKey } from "./session-key.js";

export interface StreamingTurnParams {
  sessionKey: string;
  message: string;
  source: DispatchSource;
  onDelta: (delta: string) => void;
  cardContext?: { title: string; context: string };
  turnContext?: TurnContext;
}

/**
 * Simple non-streaming dispatch for text turns (e.g. Gmail inbound).
 * Uses runInboundTurn without persisting history (current Gmail behavior).
 */
export async function dispatchInboundMessage(
  message: InboundMessage
): Promise<AgentTurnResult> {
  const sessionKey = normalizeToAgentSessionKey(message.sessionKey);
  return runInboundTurn(message.body, sessionKey);
}

/**
 * Streaming dispatch with per-session locking and history persistence.
 * Used by conversation channels (voice, WhatsApp).
 */
export async function dispatchStreamingTurn(
  params: StreamingTurnParams
): Promise<AgentTurnResult> {
  const sessionKey = normalizeToAgentSessionKey(params.sessionKey);

  return withSessionLock(sessionKey, async () => {
    const history = getSessionHistory(sessionKey);
    const result = await runAgentTurnStream(
      {
        sessionKey,
        message: params.message,
        history,
        cardContext: params.cardContext,
        turnContext: params.turnContext,
      },
      params.onDelta
    );
    setSessionHistory(sessionKey, result.history);
    return result;
  });
}

