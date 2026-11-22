import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../config/logger.js";
import { AppError } from "../shared/errors.js";
import { redactSensitivePath } from "../shared/request-path.js";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(
    new AppError(
      404,
      "ROUTE_NOT_FOUND",
      `The requested endpoint was not found: ${req.method} ${req.path}`,
    ),
  );
};

function isJsonParseError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: number }).status === 400
  );
}

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error(
        {
          err: error,
          requestId: req.requestId,
          path: redactSensitivePath(req.originalUrl.split("?")[0] ?? "/"),
        },
        "request.failed",
      );
    } else if (error.statusCode === 401 && error.code === "INVALID_CREDENTIALS") {
      logger.warn(
        {
          code: error.code,
          statusCode: error.statusCode,
          requestId: req.requestId,
          path: redactSensitivePath(req.originalUrl.split("?")[0] ?? "/"),
        },
        "request.rejected",
      );
    } else if (error.statusCode === 401) {
      logger.debug(
        {
          code: error.code,
          statusCode: error.statusCode,
          requestId: req.requestId,
          path: redactSensitivePath(req.originalUrl.split("?")[0] ?? "/"),
        },
        "request.unauthenticated",
      );
    } else if (error.statusCode === 403 || error.statusCode === 429) {
      logger.warn(
        {
          code: error.code,
          statusCode: error.statusCode,
          requestId: req.requestId,
          path: redactSensitivePath(req.originalUrl.split("?")[0] ?? "/"),
        },
        "request.rejected",
      );
    }

    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        requestId: req.requestId,
        ...(error.details ? { details: error.details } : {}),
      },
    });
    return;
  }

  if (isJsonParseError(error)) {
    res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "The request body is not valid JSON.",
        requestId: req.requestId,
      },
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "That record already exists.",
          requestId: req.requestId,
        },
      });
      return;
    }

    if (error.code === "P2025") {
      res.status(404).json({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "The requested resource was not found.",
          requestId: req.requestId,
        },
      });
      return;
    }
  }

  logger.error(
    {
      err: error,
      requestId: req.requestId,
      path: redactSensitivePath(req.originalUrl.split("?")[0] ?? "/"),
    },
    "request.failed",
  );

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      requestId: req.requestId,
    },
  });
};
