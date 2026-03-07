import type { FastifyPluginAsync } from "fastify";
import { listCronJobs, createCronJob, getCronJobById, updateCronJob, deleteCronJob } from "../cron/repo.js";
import { scheduleCronJob, stopCronJob, reloadCronScheduler } from "../cron/scheduler.js";
import type { CronJob as CronJobDto } from "../api/types.js";

const cronRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: CronJobDto[] }>("/api/cron", async (_request, reply) => {
    const rows = listCronJobs();
    const jobs: CronJobDto[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      schedule: r.schedule,
      sessionKey: r.sessionKey,
      message: r.message,
      enabled: r.enabled,
      nextRun: null,
      lastRun: r.lastRunAt,
      lastStatus: r.lastStatus,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
    return reply.send(jobs);
  });

  app.post<{
    Body: { name?: string; schedule: string; sessionKey: string; message: string; enabled?: boolean };
    Reply: CronJobDto | { error: string };
  }>("/api/cron", async (request, reply) => {
    const { name, schedule, sessionKey, message, enabled } = request.body ?? {};
    if (!schedule || !sessionKey || !message) {
      return reply.status(400).send({
        error: "schedule, sessionKey, and message are required",
      } as { error: string });
    }
    const job = createCronJob({
      name: name ?? null,
      schedule,
      sessionKey,
      message,
      enabled: enabled ?? true,
    });
    scheduleCronJob(job);
    const out: CronJobDto = {
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
    return reply.status(201).send(out);
  });

  app.put<{
    Params: { id: string };
    Body: { schedule?: string; sessionKey?: string; message?: string; enabled?: boolean };
    Reply: CronJobDto | { error: string };
  }>("/api/cron/:id", async (request, reply) => {
    const { id } = request.params;
    const body = request.body ?? {};
    const existing = getCronJobById(id);
    if (!existing) {
      return reply.status(404).send({ error: "Cron job not found" } as { error: string });
    }
    const updated = updateCronJob(id, {
      schedule: body.schedule,
      sessionKey: body.sessionKey,
      message: body.message,
      enabled: body.enabled,
    });
    if (!updated) {
      return reply.status(404).send({ error: "Cron job not found" } as { error: string });
    }
    stopCronJob(id);
    scheduleCronJob(updated);
    const out: CronJobDto = {
      id: updated.id,
      name: updated.name,
      schedule: updated.schedule,
      sessionKey: updated.sessionKey,
      message: updated.message,
      enabled: updated.enabled,
      nextRun: null,
      lastRun: updated.lastRunAt,
      lastStatus: updated.lastStatus,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
    return reply.send(out);
  });

  app.delete<{
    Params: { id: string };
    Reply: { ok: boolean } | { error: string };
  }>("/api/cron/:id", async (request, reply) => {
    const { id } = request.params;
    const existed = getCronJobById(id);
    if (!existed) {
      return reply.status(404).send({ error: "Cron job not found" } as { error: string });
    }
    stopCronJob(id);
    deleteCronJob(id);
    return reply.send({ ok: true });
  });
};

export default cronRoutes;
