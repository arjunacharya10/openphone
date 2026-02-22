// ── Generic WebSocket event envelope ──

export interface WSEvent<T = unknown> {
  type: string;
  payload: T;
  timestamp: number;
}

// ── Event type constants ──

export type ServerEventType =
  | "connected"
  | "cards:sync"
  | "card:created"
  | "card:removed"
  | "ledger:sync"
  | "action:recorded"
  | "calendar:sync";

export type ClientEventType = "card:action" | "chat:message";

// ── Card domain ──

export type CardType = "email" | "calendar" | "system";
export type CardPriority = "low" | "medium" | "high";
export type CardStatus = "active" | "dismissed" | "acted";

export interface CardAction {
  label: string;
  action: string;
}

export interface Card {
  id: string;
  type: CardType;
  title: string;
  context: string;
  priority: CardPriority;
  status: CardStatus;
  actions: CardAction[];
  sourceType?: string;
  sourceId?: string;
  createdAt: string;
}

// ── Ledger domain ──

export type ActionKind =
  | "ingest"
  | "sync"
  | "auto_archive"
  | "auto_decline"
  | "user_action"
  | "reminder";

export interface LedgerEntry {
  id: string;
  kind: ActionKind;
  refType: string;
  refId: string;
  details: Record<string, unknown>;
  timestamp: string;
}

// ── Calendar domain ──

export interface CalendarEvent {
  id: string;
  summary: string;
  startTime: string;
  endTime: string;
  location?: string;
  allDay: boolean;
}
