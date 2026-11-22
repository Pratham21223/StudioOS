import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "studioos-api" },
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      "res.headers.set-cookie",
      "password",
      "passwordHash",
      "token",
      "tokenHash",
      "csrfToken",
    ],
    censor: "[redacted]",
  },
});
