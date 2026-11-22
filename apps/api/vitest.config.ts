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
      LOG_LEVEL: "silent",
    },
  },
});
