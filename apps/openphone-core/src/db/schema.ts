import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// ── Cards ──

export const cards = sqliteTable(
  "cards",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    context: text("context").notNull().default(""),
    priority: text("priority").notNull().default("medium"),
    status: text("status").notNull().default("active"),
    actionsJson: text("actions_json").notNull().default("[]"),
    sourceType: text("source_type"),
    sourceId: text("source_id"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_cards_status").on(table.status),
    index("idx_cards_created").on(table.createdAt),
  ]
);

// ── Chat session history (one row per session) ──

export const chatSessions = sqliteTable("chat_sessions", {
  sessionKey: text("session_key").primaryKey(),
  historyJson: text("history_json").notNull().default("[]"),
  updatedAt: text("updated_at").notNull(),
});

// ── Ledger ──

export const ledger = sqliteTable(
  "ledger",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    refType: text("ref_type").notNull(),
    refId: text("ref_id").notNull(),
    detailsJson: text("details_json").notNull().default("{}"),
    timestamp: text("timestamp").notNull(),
  },
  (table) => [index("idx_ledger_timestamp").on(table.timestamp)]
);

// ── Calendar Events ──

export const calendarEvents = sqliteTable(
  "calendar_events",
  {
    id: text("id").primaryKey(),
    summary: text("summary").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    location: text("location"),
    allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [index("idx_calendar_start").on(table.startTime)]
);
