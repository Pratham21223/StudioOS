import { Queue, Worker, type JobsOptions } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { prisma } from "../database/prisma.js";
import { decryptPayload } from "../../shared/crypto.js";
import { sendEmail } from "../email/email.js";
import { reportError } from "../../shared/monitoring.js";
import type { EmailPayload } from "../../modules/notifications/notification.service.js";

export const EMAIL_QUEUE_NAME = `${env.QUEUE_PREFIX}-email`;

let connection: Redis | null = null;
let queue: Queue | null = null;

function redisUrl(): string | null {
  return env.REDIS_URL ?? null;
}

export function queueConfigured(): boolean {
  return Boolean(redisUrl());
}

export function redisConnection(): Redis {
  if (!redisUrl()) {
    throw new Error("REDIS_URL is not configured.");
  }
  if (!connection) {
    connection = new Redis(redisUrl()!, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return connection;
}

export function emailQueue(): Queue {
  if (!queue) {
    queue = new Queue(EMAIL_QUEUE_NAME, { connection: redisConnection() });
  }
  return queue;
}

const jobOptions: JobsOptions = {
  attempts: env.EMAIL_JOB_ATTEMPTS,
  backoff: { type: "exponential", delay: env.EMAIL_JOB_BACKOFF_MS },
  removeOnComplete: 500,
  removeOnFail: 1_000,
};

/**
 * Move pending outbox rows into BullMQ. Adding the same outbox ID twice is
 * harmless because BullMQ de-duplicates by jobId.
 */
export async function dispatchPendingOutbox(limit = 25): Promise<number> {
  if (!queueConfigured()) return 0;

  const pending = await prisma.outboxEvent.findMany({
    where: { status: "PENDING", availableAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let dispatched = 0;
  for (const event of pending) {
    try {
      await emailQueue().add(
        "send-email",
        { outboxId: event.id },
        { ...jobOptions, jobId: event.id },
      );
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { status: "DISPATCHED", dispatchedAt: new Date() },
      });
      dispatched += 1;
    } catch (error) {
      logger.error({ err: error, outboxId: event.id }, "outbox.dispatch_failed");
    }
  }
  return dispatched;
}

async function processEmailJob(outboxId: string): Promise<void> {
  const event = await prisma.outboxEvent.findUnique({ where: { id: outboxId } });
  if (!event) throw new Error(`Outbox event ${outboxId} not found.`);
  if (event.status === "PROCESSED") return;
  if (event.type !== "EMAIL") throw new Error(`Unsupported outbox type ${event.type}.`);

  const payload = decryptPayload<EmailPayload>(event.payloadCiphertext);
  await sendEmail(payload);
  await prisma.outboxEvent.update({
    where: { id: outboxId },
    data: {
      status: "PROCESSED",
      processedAt: new Date(),
      attempts: { increment: 1 },
      lastError: null,
    },
  });
}

async function processJob(job: {
  name: string;
  data: unknown;
  attemptsMade: number;
  opts: JobsOptions;
}): Promise<void> {
  if (job.name === "send-email") {
    const { outboxId } = job.data as { outboxId: string };
    try {
      await processEmailJob(outboxId);
    } catch (error) {
      const attempts = job.attemptsMade + 1;
      const maxAttempts = job.opts.attempts ?? 1;
      await prisma.outboxEvent
        .update({
          where: { id: outboxId },
          data: {
            attempts,
            lastError: error instanceof Error ? error.message.slice(0, 2_000) : "Unknown error",
            status: attempts >= maxAttempts ? "FAILED" : "DISPATCHED",
          },
        })
        .catch(() => undefined);
      throw error;
    }
    return;
  }

  if (job.name === "deadline-reminders") {
    const { sendDeadlineReminders } =
      await import("../../modules/notifications/deadline.service.js");
    const result = await sendDeadlineReminders();
    logger.info(result, "deadline_reminders.completed");
    return;
  }

  throw new Error(`Unknown job type ${job.name}`);
}

export function startEmailWorker(): Worker {
  const worker = new Worker(EMAIL_QUEUE_NAME, async (job) => processJob(job), {
    connection: redisConnection(),
    concurrency: 5,
  });

  worker.on("failed", (job, error) => {
    logger.error(
      { jobId: job?.id, jobName: job?.name, attemptsMade: job?.attemptsMade, err: error },
      "queue.job_failed",
    );
    reportError(error, {
      source: "worker",
      extra: {
        jobId: job?.id,
        jobName: job?.name,
        attemptsMade: job?.attemptsMade,
      },
    });
  });
  worker.on("completed", (job) => {
    logger.debug({ jobId: job.id, jobName: job.name }, "queue.job_completed");
  });
  worker.on("error", (error) => {
    logger.error({ err: error }, "queue.worker_error");
  });

  void emailQueue().upsertJobScheduler(
    "deadline-reminders",
    { every: 12 * 60 * 60 * 1000 },
    {
      name: "deadline-reminders",
      data: {},
      opts: { removeOnComplete: true, removeOnFail: 100 },
    },
  );

  return worker;
}

export async function closeQueue(): Promise<void> {
  await queue?.close();
  queue = null;
  connection?.disconnect();
  connection = null;
}
