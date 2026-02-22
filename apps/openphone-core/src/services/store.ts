import { randomUUID } from "node:crypto";
import type {
  Card,
  CardType,
  CardPriority,
  CardAction,
  LedgerEntry,
  ActionKind,
  CalendarEvent,
} from "../../../../contracts/events/index.js";
import { broadcast } from "../lib/broadcast.js";

// ── In-memory state ──

const cards: Card[] = [];
const ledger: LedgerEntry[] = [];
const calendarEvents: CalendarEvent[] = [];

const PRIORITY_ORDER: Record<CardPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const MAX_LEDGER_ENTRIES = 50;

// ── Card operations ──

export function getActiveCards(): Card[] {
  return cards
    .filter((c) => c.status === "active")
    .sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]);
}

export function createCard(opts: {
  type: CardType;
  title: string;
  context?: string;
  priority?: CardPriority;
  actions?: CardAction[];
  sourceType?: string;
  sourceId?: string;
}): Card {
  const card: Card = {
    id: randomUUID(),
    type: opts.type,
    title: opts.title,
    context: opts.context ?? "",
    priority: opts.priority ?? "medium",
    status: "active",
    actions: opts.actions ?? [],
    sourceType: opts.sourceType,
    sourceId: opts.sourceId,
    createdAt: new Date().toISOString(),
  };

  cards.push(card);

  broadcast({
    type: "card:created",
    payload: card,
    timestamp: Date.now(),
  });

  return card;
}

export function actOnCard(
  cardId: string,
  action: string
): Card | undefined {
  const card = cards.find((c) => c.id === cardId);
  if (!card || card.status !== "active") return undefined;

  card.status = action === "dismiss" ? "dismissed" : "acted";

  recordAction({
    kind: "user_action",
    refType: "card",
    refId: cardId,
    details: { action, cardTitle: card.title },
  });

  broadcast({
    type: "card:removed",
    payload: { id: cardId, action },
    timestamp: Date.now(),
  });

  return card;
}

// ── Ledger operations ──

export function getLedger(): LedgerEntry[] {
  return ledger.slice(0, MAX_LEDGER_ENTRIES);
}

export function recordAction(opts: {
  kind: ActionKind;
  refType: string;
  refId: string;
  details?: Record<string, unknown>;
}): LedgerEntry {
  const entry: LedgerEntry = {
    id: randomUUID(),
    kind: opts.kind,
    refType: opts.refType,
    refId: opts.refId,
    details: opts.details ?? {},
    timestamp: new Date().toISOString(),
  };

  ledger.unshift(entry);

  // Trim to max size
  if (ledger.length > MAX_LEDGER_ENTRIES) {
    ledger.length = MAX_LEDGER_ENTRIES;
  }

  broadcast({
    type: "action:recorded",
    payload: entry,
    timestamp: Date.now(),
  });

  return entry;
}

// ── Calendar operations ──

export function getCalendarEvents(): CalendarEvent[] {
  return calendarEvents;
}

// ── Seed demo data ──

export function seedDemoData(): void {
  const now = new Date();

  // Demo cards
  createCard({
    type: "calendar",
    title: "Standup with eng in 15 min — prep notes?",
    context:
      "Daily sync at 10:30 AM\nAgenda: sprint progress, blockers, weekend deploy plan",
    priority: "high",
    actions: [
      { label: "Prep notes", action: "prep_notes" },
      { label: "Skip", action: "skip" },
      { label: "Okay", action: "dismiss" },
    ],
    sourceType: "calendar_event",
    sourceId: "cal-001",
  });

  createCard({
    type: "email",
    title: "Re: Q4 planning deck — Alice needs feedback by EOD",
    context: "From: alice@company.com\nThread has 4 replies, last activity 2h ago",
    priority: "medium",
    actions: [
      { label: "Open thread", action: "open_thread" },
      { label: "Okay", action: "dismiss" },
    ],
    sourceType: "gmail_event",
    sourceId: "gmail-042",
  });

  // Demo calendar events
  const todayStr = now.toISOString().split("T")[0];

  calendarEvents.push(
    {
      id: "cal-001",
      summary: "Standup with eng",
      startTime: `${todayStr}T10:30:00`,
      endTime: `${todayStr}T11:00:00`,
      location: "Zoom",
      allDay: false,
    },
    {
      id: "cal-002",
      summary: "Deep work — API integration",
      startTime: `${todayStr}T13:00:00`,
      endTime: `${todayStr}T15:00:00`,
      allDay: false,
    },
    {
      id: "cal-003",
      summary: "1:1 with Sarah",
      startTime: `${todayStr}T16:00:00`,
      endTime: `${todayStr}T16:30:00`,
      location: "Coffee bar",
      allDay: false,
    }
  );

  // Demo ledger entries (added directly to avoid double-broadcast from createCard)
  const demoLedgerEntries: Omit<LedgerEntry, "id">[] = [
    {
      kind: "ingest",
      refType: "gmail_event",
      refId: "gmail-042",
      details: { subject: "Re: Q4 planning deck — feedback" },
      timestamp: new Date(now.getTime() - 15 * 60000).toISOString(),
    },
    {
      kind: "sync",
      refType: "calendar",
      refId: "primary",
      details: { subject: "Calendar synced — 3 events updated" },
      timestamp: new Date(now.getTime() - 45 * 60000).toISOString(),
    },
    {
      kind: "auto_archive",
      refType: "gmail_event",
      refId: "gmail-039",
      details: { subject: "Newsletter from TechCrunch archived" },
      timestamp: new Date(now.getTime() - 90 * 60000).toISOString(),
    },
    {
      kind: "auto_decline",
      refType: "calendar_event",
      refId: "cal-099",
      details: { subject: "Declined: optional team social" },
      timestamp: new Date(now.getTime() - 180 * 60000).toISOString(),
    },
  ];

  for (const entry of demoLedgerEntries) {
    ledger.unshift({ id: randomUUID(), ...entry });
  }
}
