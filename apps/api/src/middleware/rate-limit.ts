import type { RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import { AppError } from "../shared/errors.js";

function makeLimiter(limit: number, windowMs: number): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => env.isTest,
    handler: (req, res) => {
      const error = new AppError(
        429,
        "RATE_LIMITED",
        "Too many requests. Please wait a moment and try again.",
      );
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          requestId: req.requestId,
        },
      });
    },
  });
}

const MINUTE = 60 * 1000;

export const loginLimiter = makeLimiter(20, 15 * MINUTE);
export const registerLimiter = makeLimiter(5, 60 * MINUTE);
export const passwordResetLimiter = makeLimiter(5, 15 * MINUTE);
export const invitationAcceptLimiter = makeLimiter(20, 15 * MINUTE);
export const invitationCreateLimiter = makeLimiter(30, 60 * MINUTE);
