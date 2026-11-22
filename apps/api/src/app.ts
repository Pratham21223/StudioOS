import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { csrfProtection } from "./middleware/csrf.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestContext } from "./middleware/request-context.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { apiRouter } from "./routes.js";

export function createApp(): express.Express {
  const app = express();

  app.disable("x-powered-by");
  if (env.TRUST_PROXY) {
    app.set("trust proxy", 1);
  }

  app.use(requestContext);
  app.use(helmet());
  app.use(
    cors({
      origin: [env.WEB_ORIGIN],
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-Request-Id"],
      exposedHeaders: ["X-Request-Id"],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(csrfProtection);

  app.get("/", (_req, res) => {
    res.status(200).json({
      service: "studioos-api",
      api: "/api/v1",
      health: "/health",
    });
  });

  app.use("/health", healthRouter);
  app.use("/api/v1", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
