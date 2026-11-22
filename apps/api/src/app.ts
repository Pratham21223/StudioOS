import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { openApiSpec } from "./docs/openapi.js";
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
      ...(env.API_DOCS_ENABLED ? { docs: "/api/docs" } : {}),
      health: "/health",
    });
  });

  if (env.API_DOCS_ENABLED) {
    app.get("/api/v1/openapi.json", (_req, res) => {
      res.status(200).json(openApiSpec);
    });

    app.get("/api/docs", (_req, res) => {
      res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>StudioOS API docs</title>
    <link rel="stylesheet" href="/api/docs/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/api/docs/swagger-ui-bundle.js"></script>
    <script src="/api/docs/swagger-ui-standalone-preset.js"></script>
    <script src="/api/docs/init.js"></script>
  </body>
</html>`);
    });

    app.get("/api/docs/init.js", (_req, res) => {
      res.type("application/javascript").send(`window.onload = function () {
  window.ui = SwaggerUIBundle({
    url: "/api/v1/openapi.json",
    dom_id: "#swagger-ui",
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    layout: "BaseLayout",
    deepLinking: true,
  });
};`);
    });

    app.use("/api/docs", swaggerUi.serve);
  }

  app.use("/health", healthRouter);
  app.use("/api/v1", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
