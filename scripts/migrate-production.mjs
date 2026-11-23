#!/usr/bin/env node
/**
 * Applies committed Prisma migrations to the database in .env.production.
 *
 * Run this once before the first Vercel deployment, and again after any
 * release that includes new migrations. Vercel containers do not run
 * migrations automatically; doing so in every API instance would race.
 *
 * Usage:
 *   node scripts/migrate-production.mjs --status
 *   node scripts/migrate-production.mjs
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const options = { envFile: ".env.production", statusOnly: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--env-file") {
      options.envFile = argv[index + 1];
      index += 1;
    } else if (arg === "--status") {
      options.statusOnly = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node scripts/migrate-production.mjs [--env-file .env.production] [--status]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const envPath = path.resolve(root, options.envFile);
const fileEnv = dotenv.parse(readFileSync(envPath));
// Managed providers often expose a pooled URL for the application and a direct
// URL for migrations. Prefer the direct URL when it is supplied.
const databaseUrl =
  fileEnv.DIRECT_DATABASE_URL && !/REPLACE-WITH/i.test(fileEnv.DIRECT_DATABASE_URL)
    ? fileEnv.DIRECT_DATABASE_URL
    : fileEnv.DATABASE_URL;

if (!databaseUrl || /REPLACE-WITH|your-project/i.test(databaseUrl)) {
  console.error(`DATABASE_URL is missing or a placeholder in ${envPath}`);
  process.exit(2);
}

let host = "(unparseable)";
let database = "(unknown)";
try {
  const url = new URL(databaseUrl.replace(/^postgresql:/, "postgres:"));
  host = url.hostname;
  database = url.pathname.replace(/^\//, "") || "(unknown)";
} catch {
  // The Prisma CLI will report a more precise error below.
}

console.log(`Target: ${host} / ${database}`);
console.log(`Schema: apps/api/prisma/schema.prisma`);
console.log("");

const env = {
  ...process.env,
  ...fileEnv,
  DATABASE_URL: databaseUrl,
  NODE_ENV: "production",
};

function prisma(args) {
  return spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules/prisma/build/index.js"),
      ...args,
      "--schema",
      "apps/api/prisma/schema.prisma",
    ],
    { cwd: root, env, stdio: "inherit" },
  );
}

// `migrate status` exits non-zero when migrations are pending, which is
// exactly when `migrate deploy` is needed. Report it, then deploy anyway;
// connection or credentials errors will surface again below.
const status = prisma(["migrate", "status"]);
if (options.statusOnly) {
  process.exit(status.status ?? 0);
}

const deploy = prisma(["migrate", "deploy"]);
process.exit(deploy.status ?? 1);
