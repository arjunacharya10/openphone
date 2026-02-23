import { Type } from "@mariozechner/pi-ai";
import type { Tool, ToolCall, ToolResultMessage } from "@mariozechner/pi-ai";
import { createCard, recordAction, dismissCard, skipCard, getCardById } from "../services/store.js";
import {
  appendUserContext,
  appendMemory,
  appendDailyLog,
  readMemoryFile,
} from "./context.js";

// ── Tool definitions (what the model sees) ──

export const tools: Tool[] = [
  {
    name: "create_card",
    description:
      "Surface a card to the user in the UI when you need their input or a decision. " +
      "Use this when the action is ambiguous, high-stakes, or requires explicit approval.",
    parameters: Type.Object({
      type: Type.Union([
        Type.Literal("email"),
        Type.Literal("calendar"),
        Type.Literal("system"),
      ]),
      title: Type.String({
        description: "Short, action-oriented title shown in the UI (max ~80 chars)",
      }),
      context: Type.Optional(
        Type.String({
          description: "Supporting context the user needs to make the decision",
        })
      ),
      priority: Type.Union([
        Type.Literal("low"),
        Type.Literal("medium"),
        Type.Literal("high"),
      ]),
      actions: Type.Array(
        Type.Object({
          label: Type.String({ description: "Button label shown to the user" }),
          action: Type.String({ description: "Action identifier sent back on click" }),
        }),
        { description: "Action buttons shown on the card (2–4 recommended)" }
      ),
      sourceType: Type.Optional(Type.String()),
      sourceId: Type.Optional(Type.String()),
    }),
  },
  {
    name: "dismiss_card",
    description:
      "Close the current card and return to main chat when the user's request is fully satisfied and no further action is needed. Call this when a card discussion reaches a natural end.",
    parameters: Type.Object({}),
  },
  {
    name: "skip_card",
    description:
      "Cycle to the next card when the user wants to skip the current one (e.g. says 'skip', 'not now', 'later', 'next'). Wraps to the first card after the last. Use when the user declines to act on the current card.",
    parameters: Type.Object({}),
  },
  {
    name: "log_action",
    description:
      "Record an autonomous action you took to the ledger (visible in the Ledger view). " +
      "Call this whenever you act on the user's behalf without surfacing a card.",
    parameters: Type.Object({
      kind: Type.Union([
        Type.Literal("auto_archive"),
        Type.Literal("auto_decline"),
        Type.Literal("sync"),
        Type.Literal("ingest"),
        Type.Literal("reminder"),
      ]),
      subject: Type.String({
        description: "One-line description of the action taken",
      }),
      refType: Type.Optional(
        Type.String({ description: "Source type, e.g. 'gmail_event', 'calendar_event'" })
      ),
      refId: Type.Optional(
        Type.String({ description: "Source identifier" })
      ),
    }),
  },
  {
    name: "update_user_context",
    description:
      "Append user preferences, contacts, or communication patterns to user.md. " +
      "Use for things that describe the person you're helping.",
    parameters: Type.Object({
      content: Type.String({
        description: "Markdown content to append — be concise and factual",
      }),
    }),
  },
  {
    name: "update_memory",
    description:
      "Append long-term facts, decisions, or lessons to MEMORY.md. " +
      "Use for significant things worth remembering across sessions.",
    parameters: Type.Object({
      content: Type.String({
        description: "Markdown content to append — be concise and factual",
      }),
    }),
  },
  {
    name: "append_daily_log",
    description:
      "Append to today's raw activity log (memory/YYYY-MM-DD.md). " +
      "Use for recording what happened today — events, actions, notes.",
    parameters: Type.Object({
      content: Type.String({
        description: "Markdown content to append",
      }),
    }),
  },
  {
    name: "memory_get",
    description:
      "Read contents from MEMORY.md, user.md, or memory/YYYY-MM-DD.md. " +
      "Use when the user asks to see the full log, pull up a date's log, or read a specific memory file. " +
      "Optional from/lines for partial reads.",
    parameters: Type.Object({
      path: Type.String({
        description: "Relative path, e.g. memory/2026-02-22.md, MEMORY.md, user.md",
      }),
      from: Type.Optional(
        Type.Number({ description: "Start line (1-based)", minimum: 1 })
      ),
      lines: Type.Optional(
        Type.Number({ description: "Number of lines to read", minimum: 1 })
      ),
    }),
  },
];

export interface TurnContext {
  cardId?: string;
  cardTitle?: string;
}

// ── Tool dispatch (what actually runs) ──

export async function dispatchTool(
  toolCall: ToolCall,
  turnContext?: TurnContext
): Promise<ToolResultMessage> {
  let result: string;
  let isError = false;

  try {
    switch (toolCall.name) {
      case "dismiss_card": {
        const cardId = turnContext?.cardId;
        if (!cardId) {
          result = "No card context — dismiss_card only works when replying to a card.";
          isError = true;
          break;
        }
        const card = dismissCard(cardId);
        result = card ? "Done." : "Card not found or already closed.";
        break;
      }

      case "skip_card": {
        const cardId = turnContext?.cardId;
        if (!cardId) {
          result = "No card context — skip_card only works when replying to a card.";
          isError = true;
          break;
        }
        const card = skipCard(cardId);
        result = card ? "Cycled to next card." : "Card not found or already closed.";
        break;
      }

      case "create_card": {
        const args = toolCall.arguments;
        createCard({
          type: args["type"],
          title: args["title"],
          context: args["context"],
          priority: args["priority"],
          actions: args["actions"],
          sourceType: args["sourceType"],
          sourceId: args["sourceId"],
        });
        result = "Card created and surfaced to the user.";
        break;
      }

      case "log_action": {
        const args = toolCall.arguments;
        const refType =
          turnContext?.cardId != null ? "card" : (args["refType"] ?? "agent");
        const refId =
          turnContext?.cardId ?? (args["refId"] ?? "none");
        const cardTitle =
          turnContext?.cardTitle ??
          (refType === "card" ? getCardById(refId)?.title : undefined);
        const details: Record<string, unknown> = {
          subject: args["subject"],
          ...(cardTitle && { cardTitle }),
        };
        recordAction({
          kind: args["kind"],
          refType,
          refId,
          details,
        });
        result = "Action logged to ledger.";
        break;
      }

      case "update_user_context": {
        await appendUserContext(toolCall.arguments["content"]);
        result = "User context updated.";
        break;
      }

      case "update_memory": {
        await appendMemory(toolCall.arguments["content"]);
        result = "Memory updated.";
        break;
      }

      case "append_daily_log": {
        await appendDailyLog(toolCall.arguments["content"]);
        result = "Daily log appended.";
        break;
      }

      case "memory_get": {
        const args = toolCall.arguments;
        const pathArg = args["path"];
        const fromArg = args["from"];
        const linesArg = args["lines"];
        const from =
          fromArg != null ? Math.max(1, Math.floor(Number(fromArg))) : undefined;
        const lines =
          linesArg != null
            ? Math.max(1, Math.floor(Number(linesArg)))
            : undefined;
        const res = await readMemoryFile({
          path: typeof pathArg === "string" ? pathArg : String(pathArg ?? ""),
          from,
          lines,
        });
        result = JSON.stringify(res);
        break;
      }

      default:
        result = `Unknown tool: ${toolCall.name}`;
        isError = true;
    }
  } catch (err) {
    result = `Tool error: ${String(err)}`;
    isError = true;
  }

  return {
    role: "toolResult",
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    content: [{ type: "text", text: result }],
    isError,
    timestamp: Date.now(),
  };
}
