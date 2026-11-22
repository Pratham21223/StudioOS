import { Router } from "express";
import { prisma } from "../../infrastructure/database/prisma.js";

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
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: "ready",
      checks: { database: "ok" },
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: "not_ready",
      checks: { database: "error" },
      timestamp: new Date().toISOString(),
    });
  }
});
