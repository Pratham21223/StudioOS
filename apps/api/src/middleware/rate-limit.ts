import type { RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { Redis } from "ioredis";
import { RedisStore } from "rate-limit-redis";
import { env } from "../config/env.js";
import { AppError } from "../shared/errors.js";

let limiterRedis: Redis | null = null;

/**
 * A dedicated, fail-fast connection for rate limiting. The BullMQ connection
 * uses `maxRetriesPerRequest: null` and may queue commands while Redis is
 * unavailable; sharing it here could make sign-in requests hang instead of
 * letting `passOnStoreError` open the gate.
 */
function limiterConnection(): Redis {
  if (!limiterRedis) {
    limiterRedis = new Redis(env.REDIS_URL!, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      connectTimeout: 2_000,
    });
    // ioredis emits connection errors asynchronously; readiness reports the
    // degradation, and passOnStoreError keeps requests flowing.
    limiterRedis.on("error", () => undefined);
  }
  return limiterRedis;
}

/**
 * Use Redis for rate limiting whenever it is configured. Vercel can run
 * several API instances and scales to zero, so the default in-memory store
 * would let a caller get a fresh budget from every instance.
 */
function makeStore(prefix: string): RedisStore | undefined {
  if (env.isTest || !env.REDIS_URL) return undefined;
  return new RedisStore({
    prefix: `studioos:rl:${prefix}:`,
    sendCommand: (command: string, ...args: string[]) =>
      limiterConnection().call(command, ...args) as Promise<number>,
  });
}

function makeLimiter(limit: number, windowMs: number, name: string): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => env.isTest,
    passOnStoreError: true,
    store: makeStore(name),
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

export const loginLimiter = makeLimiter(20, 15 * MINUTE, "login");
export const registerLimiter = makeLimiter(5, 60 * MINUTE, "register");
export const passwordResetLimiter = makeLimiter(5, 15 * MINUTE, "password-reset");
export const invitationAcceptLimiter = makeLimiter(20, 15 * MINUTE, "invitation-accept");
export const invitationCreateLimiter = makeLimiter(30, 60 * MINUTE, "invitation-create");
