import { CronJob } from "cron";
import type { CronJobRow } from "./types.js";
import { listCronJobs, recordCronJobRun } from "./repo.js";
import { dispatchInboundMessage } from "../gateway/dispatch.js";

const activeJobs = new Map<string, CronJob>();

/**
 * Ensure cron expression has 6 fields (seconds + standard 5) for node-cron.
 * Standard 5-field: "0 9 * * *" (9am daily) → "0 0 9 * * *" (second 0, minute 0, hour 9)
 */
function normalizeCronExpr(schedule: string): string {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length === 6) return schedule;
  if (parts.length === 5) return `0 ${schedule}`;
  throw new Error(`Invalid cron schedule: ${schedule}`);
}

function runJob(job: CronJobRow): void {
  const inbound = {
    sessionKey: job.sessionKey,
    body: job.message,
    source: "cron" as const,
    metadata: { cronJobId: job.id, cronJobName: job.name ?? undefined },
  };
  dispatchInboundMessage(inbound)
    .then(() => recordCronJobRun(job.id, "ok"))
    .catch((err) => {
      console.error(`Cron job ${job.id} failed:`, err);
      recordCronJobRun(job.id, "error");
    });
}

/**
 * Start scheduler: load jobs from DB and schedule enabled ones.
 */
export function startCronScheduler(): void {
  const jobs = listCronJobs();
  for (const job of jobs) {
    if (!job.enabled) continue;
    try {
      const expr = normalizeCronExpr(job.schedule);
      const cronJob = new CronJob(
        expr,
        () => runJob(job),
        null,
        true
      );
      activeJobs.set(job.id, cronJob);
    } catch (err) {
      console.error(`Failed to schedule cron job ${job.id}:`, err);
    }
  }
}

/**
 * Stop a single job by id.
 */
export function stopCronJob(id: string): void {
  const cronJob = activeJobs.get(id);
  if (cronJob) {
    cronJob.stop();
    activeJobs.delete(id);
  }
}

/**
 * Add and start a job.
 */
export function scheduleCronJob(job: CronJobRow): void {
  if (!job.enabled) return;
  stopCronJob(job.id);
  try {
    const expr = normalizeCronExpr(job.schedule);
    const cronJob = new CronJob(
      expr,
      () => runJob(job),
      null,
      true
    );
    activeJobs.set(job.id, cronJob);
  } catch (err) {
    console.error(`Failed to schedule cron job ${job.id}:`, err);
  }
}

/**
 * Reload all jobs from DB (stop existing, start fresh).
 */
export function reloadCronScheduler(): void {
  for (const [id] of activeJobs) {
    stopCronJob(id);
  }
  startCronScheduler();
}
