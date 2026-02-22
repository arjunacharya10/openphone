import { completeSimple, getModel } from "@mariozechner/pi-ai";
import type { Api, KnownProvider, Message, Model, ToolCall, TextContent } from "@mariozechner/pi-ai";
import {
  loadAgentConfig,
  loadUserContext,
  buildSystemPrompt,
} from "./context.js";
import { tools, dispatchTool } from "./tools.js";

const MAX_ITERATIONS = 10;

export interface AgentTurnParams {
  /** Identifies the ongoing task — same key continues the same conversation */
  sessionKey: string;
  /** The user's message or inbound event description */
  message: string;
  /** Prior conversation history for this session (pass [] for new sessions) */
  history?: Message[];
}

export interface AgentTurnResult {
  /** Final text response (may be empty if agent only used tools) */
  text: string;
  /** Full updated message history — persist this per sessionKey */
  history: Message[];
  /** Number of tool calls made */
  toolCallCount: number;
}

// ── Model resolution ──

function resolveModel(modelStr: string): Model<Api> {
  const slash = modelStr.indexOf("/");
  const provider = modelStr.slice(0, slash);
  const modelId = modelStr.slice(slash + 1);

  if (provider === "ollama") {
    return {
      id: modelId,
      name: modelId,
      api: "openai-completions",
      provider: "ollama",
      baseUrl: process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434/v1",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 4096,
      headers: {},
    } satisfies Model<"openai-completions">;
  }

  // Built-in provider — let pi-ai resolve it
  return getModel(provider as KnownProvider, modelId as never);
}

// ── Agent turn ──

export async function runAgentTurn(params: AgentTurnParams): Promise<AgentTurnResult> {
  const [config, userMd] = await Promise.all([
    loadAgentConfig(),
    loadUserContext(),
  ]);

  const systemPrompt = buildSystemPrompt(config, userMd);
  const model = resolveModel(config.model);

  const messages: Message[] = [
    ...(params.history ?? []),
    {
      role: "user",
      content: params.message,
      timestamp: Date.now(),
    },
  ];

  let toolCallCount = 0;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const result = await completeSimple(model, {
      systemPrompt,
      messages,
      tools,
    });

    messages.push(result);

    if (result.stopReason !== "toolUse") break;

    // Dispatch all tool calls in this turn
    const toolCalls = result.content.filter(
      (b): b is ToolCall => b.type === "toolCall"
    );

    for (const toolCall of toolCalls) {
      toolCallCount++;
      const toolResult = await dispatchTool(toolCall);
      messages.push(toolResult);
    }
  }

  // Extract final text from the last assistant message
  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");

  const text = lastAssistant
    ? (lastAssistant as { content: unknown[] }).content
        .filter((b): b is TextContent => (b as TextContent).type === "text")
        .map((b) => b.text)
        .join("")
    : "";

  return { text, history: messages, toolCallCount };
}

// ── Convenience: run a turn from an inbound event (no prior history) ──

export async function runInboundTurn(
  eventDescription: string,
  sessionKey: string
): Promise<AgentTurnResult> {
  return runAgentTurn({ sessionKey, message: eventDescription, history: [] });
}
