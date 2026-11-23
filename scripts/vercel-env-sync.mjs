#!/usr/bin/env node
/**
 * Syncs .env.production into the linked Vercel project's Production
 * environment, without printing any values.
 *
 * Prerequisites:
 *   npx vercel login
 *   npx vercel link
 *
 * Usage:
 *   node scripts/vercel-env-sync.mjs --dry-run
 *   node scripts/vercel-env-sync.mjs
 *
 * Vercel containers and daemons read environment variables at deploy time, so
 * create a new production deployment after syncing.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Used only by docker-compose.prod.yml; not meaningful to the Vercel runtime.
const COMPOSE_ONLY = new Set([
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_DB",
  "REDIS_PASSWORD",
  "WEB_PORT",
  "API_IMAGE",
  "WEB_IMAGE",
]);

// Local CLI/CI values that must never be uploaded to the project.
const LOCAL_ONLY = new Set([
  "VERCEL_TOKEN",
  "VERCEL_ORG_ID",
  "VERCEL_PROJECT_ID",
  "VERCEL_TEAM_ID",
  // Migration-only direct database URL; the runtime uses DATABASE_URL.
  "DIRECT_DATABASE_URL",
]);

// Managed by Vercel or the container image; setting them manually is noise.
const VERCEL_MANAGED = new Set(["NODE_ENV"]);

function parseArgs(argv) {
  const options = { envFile: ".env.production", dryRun: false, project: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--env-file") {
      options.envFile = argv[index + 1];
      index += 1;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--project") {
      options.project = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node scripts/vercel-env-sync.mjs [--env-file .env.production] [--project name] [--dry-run]",
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

if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}. Copy .env.production.example first.`);
  process.exit(2);
}

const fileEnv = dotenv.parse(readFileSync(envPath));
const entries = Object.entries(fileEnv).filter(
  ([name]) => !COMPOSE_ONLY.has(name) && !LOCAL_ONLY.has(name) && !VERCEL_MANAGED.has(name),
);

const placeholders = entries.filter(
  ([, value]) => value && /REPLACE-WITH|your-project|your-org/i.test(value),
);
if (placeholders.length > 0) {
  console.error(
    `Refusing to sync placeholder values: ${placeholders.map(([name]) => name).join(", ")}`,
  );
  process.exit(2);
}

console.log(`Source: ${path.relative(root, envPath)}`);
console.log(`Variables: ${entries.length}`);
console.log(
  `Empty (removed from Vercel to avoid stale values): ${
    entries
      .filter(([, value]) => value === "")
      .map(([name]) => name)
      .join(", ") || "none"
  }`,
);

if (options.dryRun) {
  for (const [name, value] of entries) {
    console.log(`${value === "" ? "remove" : "set"}  ${name}`);
  }
  process.exit(0);
}

function runVercel(args, input) {
  const result = spawnSync("npx", ["--yes", "vercel@latest", ...args], {
    cwd: root,
    input,
    encoding: "utf8",
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
    // Removing a variable that was never set is a no-op, not a failure.
    if (/"reason":\s*"env_not_found"/.test(output)) return output;
    const detail = output.split("\n").slice(-8).join("\n");
    throw new Error(`vercel ${args.join(" ")} failed: ${detail}`);
  }
  return result.stdout;
}

const whoami = spawnSync("npx", ["--yes", "vercel@latest", "whoami"], {
  cwd: root,
  encoding: "utf8",
  env: process.env,
});
if (whoami.status !== 0 || /Logged out/i.test(whoami.stdout)) {
  console.error("Vercel CLI is not logged in. Run `npx vercel login` first.");
  process.exit(2);
}

if (!existsSync(path.join(root, ".vercel/project.json"))) {
  console.error("This directory is not linked to a Vercel project. Run `npx vercel link` first.");
  process.exit(2);
}

const projectArgs = options.project ? ["--project", options.project] : [];
let failures = 0;

for (const [name, value] of entries) {
  try {
    if (value === "") {
      runVercel([
        "env",
        "remove",
        name,
        "--environment",
        "production",
        "--confirm-name",
        name,
        ...projectArgs,
      ]);
      console.log(`removed  ${name}`);
    } else {
      // The value is passed on stdin so it never appears in the process list.
      runVercel(
        ["env", "add", name, "--environment", "production", "--force", "--yes", ...projectArgs],
        `${value}\n`,
      );
      console.log(`set      ${name}`);
    }
  } catch (error) {
    failures += 1;
    console.error(`FAILED   ${name}: ${error.message}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} variable(s) failed to sync.`);
  process.exitCode = 1;
} else {
  console.log("\nEnvironment synced. Create a new production deployment to apply it.");
}
