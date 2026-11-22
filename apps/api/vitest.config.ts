import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://studioos:studioos@localhost:5432/studio_os_test";

const testSessionSecret =
  process.env.TEST_SESSION_SECRET ?? "test-only-session-secret-at-least-32-characters-long";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    fileParallelism: false,
    globalSetup: ["./tests/global-setup.ts"],
    include: ["tests/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl,
      TEST_DATABASE_URL: testDatabaseUrl,
      SESSION_SECRET: testSessionSecret,
      SESSION_COOKIE_NAME: "studioos_session",
      CSRF_COOKIE_NAME: "studioos_csrf",
      SESSION_TTL_HOURS: "168",
      PASSWORD_RESET_TTL_MINUTES: "60",
      INVITATION_TTL_HOURS: "168",
      WEB_ORIGIN: "http://localhost:5174",
      INVITATION_BASE_URL: "http://localhost:5174/invitations",
      PASSWORD_RESET_BASE_URL: "http://localhost:5174/password/reset",
      S3_REGION: "us-east-1",
      S3_BUCKET: "studioos-test",
      S3_ACCESS_KEY_ID: "test",
      S3_SECRET_ACCESS_KEY: "test",
      S3_ENDPOINT: "http://localhost:9090",
      S3_AUTO_CREATE_BUCKET: "true",
      UPLOAD_URL_TTL_MINUTES: "15",
      DOWNLOAD_URL_TTL_MINUTES: "10",
      ASSET_MAX_BYTES: "262144000",
      REDIS_URL: "redis://localhost:6380",
      EMAIL_PROVIDER: "console",
      EMAIL_FROM: "StudioOS <no-reply@example.test>",
      QUEUE_PREFIX: "studioos-test",
      EMAIL_JOB_ATTEMPTS: "2",
      EMAIL_JOB_BACKOFF_MS: "50",
      LOG_LEVEL: "silent",
    },
  },
});
