import { Router } from "express";
import { prisma } from "../../infrastructure/database/prisma.js";
import { queueConfigured, redisConnection } from "../../infrastructure/queue/queue.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "studioos-api",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get("/ready", async (_req, res) => {
  const checks: Record<string, string> = { database: "error" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";

    if (queueConfigured()) {
      try {
        await Promise.race([
          redisConnection().ping(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Redis readiness timeout")), 2_000).unref(),
          ),
        ]);
        checks.redis = "ok";
      } catch {
        checks.redis = "error";
      }
    }

    const ready = Object.values(checks).every((value) => value === "ok");
    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "not_ready",
      checks,
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: "not_ready",
      checks,
      timestamp: new Date().toISOString(),
    });
  }
});
