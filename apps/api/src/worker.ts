import { logger } from "./config/logger.js";
import { prisma } from "./infrastructure/database/prisma.js";
import {
  closeQueue,
  dispatchPendingOutbox,
  startEmailWorker,
} from "./infrastructure/queue/queue.js";

const worker = startEmailWorker();
let dispatching = false;

async function dispatch(): Promise<void> {
  if (dispatching) return;
  dispatching = true;
  try {
    const count = await dispatchPendingOutbox();
    if (count > 0) logger.info({ count }, "outbox.dispatched");
  } catch (error) {
    logger.error({ err: error }, "outbox.dispatch_error");
  } finally {
    dispatching = false;
  }
}

void dispatch();
const interval = setInterval(() => void dispatch(), 3_000);
interval.unref();

logger.info({ queue: "studioos-email" }, "worker.started");

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "worker.shutdown_started");
  clearInterval(interval);
  await worker.close();
  await closeQueue();
  await prisma.$disconnect();
  logger.info("worker.shutdown_complete");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
