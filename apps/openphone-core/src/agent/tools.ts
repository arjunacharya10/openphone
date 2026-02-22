import { Type } from "@mariozechner/pi-ai";
import type { Tool, ToolCall, ToolResultMessage } from "@mariozechner/pi-ai";
import { createCard, recordAction } from "../services/store.js";
import { appendUserContext } from "./context.js";

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
      "Append new information about the user to user.md. " +
      "Use this when you observe a preference, contact, or pattern worth remembering across sessions.",
    parameters: Type.Object({
      content: Type.String({
        description: "Markdown content to append — be concise and factual",
      }),
    }),
  },
];

// ── Tool dispatch (what actually runs) ──

export async function dispatchTool(toolCall: ToolCall): Promise<ToolResultMessage> {
  let result: string;
  let isError = false;

  try {
    switch (toolCall.name) {
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
        recordAction({
          kind: args["kind"],
          refType: args["refType"] ?? "agent",
          refId: args["refId"] ?? "none",
          details: { subject: args["subject"] },
        });
        result = "Action logged to ledger.";
        break;
      }

      case "update_user_context": {
        await appendUserContext(toolCall.arguments["content"]);
        result = "User context updated.";
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
