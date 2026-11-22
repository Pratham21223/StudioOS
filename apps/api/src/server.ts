import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { prisma } from "./infrastructure/database/prisma.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, environment: env.NODE_ENV, webOrigin: env.WEB_ORIGIN },
    "api.started",
  );
});

server.on("error", (error) => {
  logger.fatal({ err: error }, "api.listen_failed");
  process.exitCode = 1;
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "api.shutdown_started");

  const forceExit = setTimeout(() => {
    logger.error("api.shutdown_timeout");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async () => {
    try {
      await prisma.$disconnect();
      logger.info("api.shutdown_complete");
      clearTimeout(forceExit);
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, "api.shutdown_failed");
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
