import { existsSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

/**
 * Load a local .env file outside production. Existing process env always wins,
 * which keeps tests and container deploys authoritative.
 */
function loadLocalEnvFile(): void {
  if (process.env.NODE_ENV === "production") return;

  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
  ];
  const match = candidates.find((candidate) => existsSync(candidate));
  if (match) {
    dotenv.config({ path: match, quiet: true });
  }
}

loadLocalEnvFile();

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  WEB_ORIGIN: z.string().url(),
  API_BASE_URL: optionalUrl,
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),

  SESSION_SECRET: z.string().min(32),
  SESSION_COOKIE_NAME: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, "Cookie names may only contain letters, numbers, _ and -"),
  CSRF_COOKIE_NAME: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, "Cookie names may only contain letters, numbers, _ and -"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
  INVITATION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
  EMAIL_OTP_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
  EMAIL_OTP_RESEND_SECONDS: z.coerce.number().int().min(10).max(600).default(60),
  EMAIL_OTP_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),

  INVITATION_BASE_URL: z.string().url(),
  PASSWORD_RESET_BASE_URL: z.string().url(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: optionalUrl,
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL: optionalUrl,

  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: optionalUrl,
  S3_AUTO_CREATE_BUCKET: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  UPLOAD_URL_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  DOWNLOAD_URL_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
  ASSET_MAX_BYTES: z.coerce.number().int().min(1).default(262_144_000),

  EMAIL_PROVIDER: z.enum(["console", "resend", "brevo", "smtp"]).default("console"),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  QUEUE_PREFIX: z.string().min(1).max(32).default("studioos"),
  EMAIL_JOB_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(4),
  EMAIL_JOB_BACKOFF_MS: z.coerce.number().int().min(10).max(600_000).default(5_000),
  MONITORING_WEBHOOK_URL: optionalUrl,
  API_DOCS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  DEV_LINKS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  SEED_PASSWORD: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === "production",
  isTest: parsed.data.NODE_ENV === "test",
  isDevelopment: parsed.data.NODE_ENV === "development",
} as const;

export type Env = typeof env;
