import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { logger } from "../config/logger.js";
import { redactSensitivePath } from "../shared/request-path.js";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Attaches a trusted request id, echoes it to the client, and emits one
 * structured access log line after the response finishes. Query strings are
 * intentionally excluded because invitation and reset tokens travel in links.
 */
export const requestContext: RequestHandler = (req, res, next) => {
  const incomingRequestId = req.get("x-request-id");
  const requestId =
    incomingRequestId && REQUEST_ID_PATTERN.test(incomingRequestId)
      ? incomingRequestId
      : randomUUID();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  const startedAt = performance.now();
  res.on("finish", () => {
    logger.info(
      {
        requestId,
        method: req.method,
        path: redactSensitivePath(req.originalUrl.split("?")[0] ?? "/"),
        statusCode: res.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
        userId: req.auth?.user.id,
        organizationId: req.tenant?.organizationId,
      },
      "request.completed",
    );
  });

  next();
};
