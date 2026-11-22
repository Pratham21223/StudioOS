import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { encryptPayload } from "../src/shared/crypto.js";
import { prisma } from "../src/infrastructure/database/prisma.js";
import {
  closeQueue,
  dispatchPendingOutbox,
  emailQueue,
  startEmailWorker,
} from "../src/infrastructure/queue/queue.js";
import type { EmailPayload } from "../src/modules/notifications/notification.service.js";
import { resetDatabase } from "./helpers.js";

describe("BullMQ email worker", () => {
  beforeEach(async () => {
    await resetDatabase();
    await emailQueue().obliterate({ force: true });
  });

  afterEach(async () => {
    await closeQueue();
  });

  it("processes valid outbox rows and marks exhausted retries as failed", async () => {
    const valid = await prisma.outboxEvent.create({
      data: {
        type: "EMAIL",
        payloadCiphertext: encryptPayload({
          to: "worker@example.test",
          subject: "Queue smoke test",
          text: "Queued email",
        } satisfies EmailPayload),
      },
    });
    const invalid = await prisma.outboxEvent.create({
      data: {
        type: "EMAIL",
        payloadCiphertext: "v1:invalid:payload:data",
      },
    });

    const worker = startEmailWorker();
    const dispatched = await dispatchPendingOutbox();
    expect(dispatched).toBe(2);

    const deadline = Date.now() + 15_000;
    let events = await prisma.outboxEvent.findMany();
    while (
      Date.now() < deadline &&
      events.some((event) => event.status === "PENDING" || event.status === "DISPATCHED")
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      events = await prisma.outboxEvent.findMany();
    }

    const processed = events.find((event) => event.id === valid.id);
    const failed = events.find((event) => event.id === invalid.id);
    expect(processed?.status).toBe("PROCESSED");
    expect(processed?.attempts).toBe(1);
    expect(processed?.processedAt).not.toBeNull();
    expect(failed?.status).toBe("FAILED");
    expect(failed?.attempts).toBe(2);
    expect(failed?.lastError).toBeTruthy();
    expect(failed?.processedAt).toBeNull();

    const failedJobs = await emailQueue().getFailed();
    expect(failedJobs.some((job) => job.data.outboxId === invalid.id)).toBe(true);

    await worker.close();
  });
});
