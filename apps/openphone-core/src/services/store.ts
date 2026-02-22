import { randomUUID } from "node:crypto";
import { eq, desc, sql } from "drizzle-orm";
import type {
  Card,
  CardType,
  CardPriority,
  CardAction,
  LedgerEntry,
  ActionKind,
  CalendarEvent,
} from "../../../../contracts/events/index.js";
import { db } from "../db/index.js";
import {
  cards as cardsTable,
  ledger as ledgerTable,
  calendarEvents as calendarEventsTable,
} from "../db/schema.js";
import { broadcast } from "../lib/broadcast.js";

const MAX_LEDGER_ENTRIES = 50;

// ── Row → domain object helpers ──

function rowToCard(row: typeof cardsTable.$inferSelect): Card {
  return {
    id: row.id,
    type: row.type as CardType,
    title: row.title,
    context: row.context,
    priority: row.priority as CardPriority,
    status: row.status as Card["status"],
    actions: JSON.parse(row.actionsJson) as CardAction[],
    sourceType: row.sourceType ?? undefined,
    sourceId: row.sourceId ?? undefined,
    createdAt: row.createdAt,
  };
}

function rowToLedgerEntry(row: typeof ledgerTable.$inferSelect): LedgerEntry {
  return {
    id: row.id,
    kind: row.kind as ActionKind,
    refType: row.refType,
    refId: row.refId,
    details: JSON.parse(row.detailsJson) as Record<string, unknown>,
    timestamp: row.timestamp,
  };
}

function rowToCalendarEvent(
  row: typeof calendarEventsTable.$inferSelect
): CalendarEvent {
  return {
    id: row.id,
    summary: row.summary,
    startTime: row.startTime,
    endTime: row.endTime,
    location: row.location ?? undefined,
    allDay: row.allDay,
  };
}

// ── Card operations ──

export function getActiveCards(): Card[] {
  const rows = db
    .select()
    .from(cardsTable)
    .where(eq(cardsTable.status, "active"))
    .orderBy(
      sql`CASE ${cardsTable.priority} WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END`
    )
    .all();

  return rows.map(rowToCard);
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
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  db.insert(cardsTable)
    .values({
      id,
      type: opts.type,
      title: opts.title,
      context: opts.context ?? "",
      priority: opts.priority ?? "medium",
      status: "active",
      actionsJson: JSON.stringify(opts.actions ?? []),
      sourceType: opts.sourceType,
      sourceId: opts.sourceId,
      createdAt,
    })
    .run();

  const card: Card = {
    id,
    type: opts.type,
    title: opts.title,
    context: opts.context ?? "",
    priority: opts.priority ?? "medium",
    status: "active",
    actions: opts.actions ?? [],
    sourceType: opts.sourceType,
    sourceId: opts.sourceId,
    createdAt,
  };

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
  const rows = db
    .select()
    .from(cardsTable)
    .where(eq(cardsTable.id, cardId))
    .all();

  if (rows.length === 0) return undefined;
  const row = rows[0];
  if (row.status !== "active") return undefined;

  const newStatus = action === "dismiss" ? "dismissed" : "acted";

  db.update(cardsTable)
    .set({ status: newStatus })
    .where(eq(cardsTable.id, cardId))
    .run();

  const card = rowToCard({ ...row, status: newStatus });

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
  const rows = db
    .select()
    .from(ledgerTable)
    .orderBy(desc(ledgerTable.timestamp))
    .limit(MAX_LEDGER_ENTRIES)
    .all();

  return rows.map(rowToLedgerEntry);
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

  db.insert(ledgerTable)
    .values({
      id: entry.id,
      kind: entry.kind,
      refType: entry.refType,
      refId: entry.refId,
      detailsJson: JSON.stringify(entry.details),
      timestamp: entry.timestamp,
    })
    .run();

  broadcast({
    type: "action:recorded",
    payload: entry,
    timestamp: Date.now(),
  });

  return entry;
}

// ── Calendar operations ──

export function getCalendarEvents(): CalendarEvent[] {
  const rows = db
    .select()
    .from(calendarEventsTable)
    .orderBy(calendarEventsTable.startTime)
    .all();

  return rows.map(rowToCalendarEvent);
}

// ── Seed demo data (idempotent) ──

export function seedDemoData(): void {
  const existing = db
    .select({ id: cardsTable.id })
    .from(cardsTable)
    .limit(1)
    .all();

  if (existing.length > 0) return;

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

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
    context:
      "From: alice@company.com\nThread has 4 replies, last activity 2h ago",
    priority: "medium",
    actions: [
      { label: "Open thread", action: "open_thread" },
      { label: "Okay", action: "dismiss" },
    ],
    sourceType: "gmail_event",
    sourceId: "gmail-042",
  });

  // Demo calendar events
  const demoEvents = [
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
      location: null,
      allDay: false,
    },
    {
      id: "cal-003",
      summary: "1:1 with Sarah",
      startTime: `${todayStr}T16:00:00`,
      endTime: `${todayStr}T16:30:00`,
      location: "Coffee bar",
      allDay: false,
    },
  ];

  for (const ev of demoEvents) {
    db.insert(calendarEventsTable).values(ev).run();
  }

  // Demo ledger entries
  const demoLedger = [
    {
      kind: "ingest" as const,
      refType: "gmail_event",
      refId: "gmail-042",
      details: { subject: "Re: Q4 planning deck — feedback" },
      timestamp: new Date(now.getTime() - 15 * 60000).toISOString(),
    },
    {
      kind: "sync" as const,
      refType: "calendar",
      refId: "primary",
      details: { subject: "Calendar synced — 3 events updated" },
      timestamp: new Date(now.getTime() - 45 * 60000).toISOString(),
    },
    {
      kind: "auto_archive" as const,
      refType: "gmail_event",
      refId: "gmail-039",
      details: { subject: "Newsletter from TechCrunch archived" },
      timestamp: new Date(now.getTime() - 90 * 60000).toISOString(),
    },
    {
      kind: "auto_decline" as const,
      refType: "calendar_event",
      refId: "cal-099",
      details: { subject: "Declined: optional team social" },
      timestamp: new Date(now.getTime() - 180 * 60000).toISOString(),
    },
  ];

  for (const entry of demoLedger) {
    db.insert(ledgerTable)
      .values({
        id: randomUUID(),
        kind: entry.kind,
        refType: entry.refType,
        refId: entry.refId,
        detailsJson: JSON.stringify(entry.details),
        timestamp: entry.timestamp,
      })
      .run();
  }
}
