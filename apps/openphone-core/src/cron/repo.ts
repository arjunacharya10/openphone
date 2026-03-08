import { randomUUID } from "node:crypto";
import type { CronJobRow } from "./types.js";
import type { CronJob as CronJobDto } from "../api/types.js";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { cronJobs } from "../db/schema.js";

function rowToCronJob(r: typeof cronJobs.$inferSelect): CronJobRow {
  return {
    id: r.id,
    name: r.name,
    schedule: r.schedule,
    sessionKey: r.sessionKey,
    message: r.message,
    enabled: r.enabled,
    lastRunAt: r.lastRunAt,
    lastStatus: r.lastStatus,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export function toCronJobDto(job: CronJobRow): CronJobDto {
  return {
    id: job.id,
    name: job.name,
    schedule: job.schedule,
    sessionKey: job.sessionKey,
    message: job.message,
    enabled: job.enabled,
    nextRun: null,
    lastRun: job.lastRunAt,
    lastStatus: job.lastStatus,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export function listCronJobs(): CronJobRow[] {
  return db.select().from(cronJobs).all().map(rowToCronJob);
}

export function getCronJobById(id: string): CronJobRow | null {
  const rows = db.select().from(cronJobs).where(eq(cronJobs.id, id)).limit(1).all();
  return rows.length === 0 ? null : rowToCronJob(rows[0]);
}

export function createCronJob(opts: {
  name?: string | null;
  schedule: string;
  sessionKey: string;
  message: string;
  enabled?: boolean;
}): CronJobRow {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.insert(cronJobs)
    .values({
      id,
      name: opts.name ?? null,
      schedule: opts.schedule,
      sessionKey: opts.sessionKey,
      message: opts.message,
      enabled: opts.enabled ?? true,
      lastRunAt: null,
      lastStatus: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  const job = getCronJobById(id);
  if (!job) throw new Error("Failed to create cron job");
  return job;
}

export function updateCronJob(
  id: string,
  opts: Partial<{ schedule: string; sessionKey: string; message: string; enabled: boolean }>
): CronJobRow | null {
  const existing = getCronJobById(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (opts.schedule != null) updates.schedule = opts.schedule;
  if (opts.sessionKey != null) updates.sessionKey = opts.sessionKey;
  if (opts.message != null) updates.message = opts.message;
  if (opts.enabled != null) updates.enabled = opts.enabled;
  db.update(cronJobs).set(updates as Record<string, never>).where(eq(cronJobs.id, id)).run();
  return getCronJobById(id);
}

export function recordCronJobRun(id: string, status: "ok" | "error"): void {
  const now = new Date().toISOString();
  db.update(cronJobs)
    .set({ lastRunAt: now, lastStatus: status, updatedAt: now })
    .where(eq(cronJobs.id, id))
    .run();
}

export function deleteCronJob(id: string): boolean {
  const existing = getCronJobById(id);
  if (!existing) return false;
  db.delete(cronJobs).where(eq(cronJobs.id, id)).run();
  return true;
}
