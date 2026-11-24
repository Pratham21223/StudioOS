#!/usr/bin/env node
/**
 * Verifies the external services StudioOS depends on before a production
 * deployment:
 *
 *   - PostgreSQL connectivity, schema state, and pending migrations
 *   - Redis connectivity (BullMQ)
 *   - S3-compatible storage read/write/head and bucket CORS
 *   - Configured email provider (Resend, Brevo, or SMTP)
 *   - Optional monitoring webhook
 *
 * Usage:
 *   node scripts/check-external-services.mjs
 *   node scripts/check-external-services.mjs --env-file .env
 *   node scripts/check-external-services.mjs --send-email you@example.com
 *
 * The script never prints credential values. It exits non-zero only when a
 * service that is configured and expected to work fails.
 */

import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DeleteObjectCommand,
  GetBucketCorsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { Redis } from "ioredis";
import nodemailer from "nodemailer";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const options = { envFile: ".env.production", sendEmail: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--env-file") {
      options.envFile = argv[index + 1];
      index += 1;
    } else if (arg === "--send-email") {
      options.sendEmail = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node scripts/check-external-services.mjs [--env-file .env.production] [--send-email to@example.com]",
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

let fileEnv;
try {
  fileEnv = dotenv.parse(readFileSync(envPath));
} catch (error) {
  console.error(`Cannot read ${envPath}: ${error.message}`);
  process.exit(2);
}

// The deployment file wins over stale shell variables for this check.
const env = { ...process.env, ...fileEnv };
const secrets = [
  env.DATABASE_URL,
  env.REDIS_URL,
  env.SESSION_SECRET,
  env.S3_ACCESS_KEY_ID,
  env.S3_SECRET_ACCESS_KEY,
  env.EMAIL_API_KEY,
  env.BREVO_API_KEY,
  env.SMTP_PASSWORD,
  env.MONITORING_WEBHOOK_URL,
].filter(Boolean);

function redact(value) {
  let text = String(value ?? "");
  for (const secret of secrets) {
    if (secret.length >= 6) text = text.split(secret).join("***");
  }
  return text.replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, "$1***");
}

function safeHost(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}`;
  } catch {
    return "(invalid URL)";
  }
}

const results = [];
function record(name, status, detail = "") {
  results.push({ name, status, detail });
  const suffix = detail ? `  (${redact(detail)})` : "";
  console.log(`${status.padEnd(4)}  ${name}${suffix}`);
}

function isPlaceholder(value) {
  return /REPLACE-WITH|your-project|your-org|your-bucket|your-verified-domain/i.test(value ?? "");
}

function requireValue(name, value) {
  if (!value || isPlaceholder(value)) {
    record(`${name} is configured`, "FAIL", value ? "placeholder value" : "missing");
    return false;
  }
  record(`${name} is configured`, "PASS");
  return true;
}

async function checkDatabase() {
  if (!requireValue("DATABASE_URL", env.DATABASE_URL)) return;
  if (!/^postgres(ql)?:\/\//i.test(env.DATABASE_URL)) {
    record("DATABASE_URL is a PostgreSQL URL", "FAIL", "expected postgresql://");
    return;
  }

  const parsed = new URL(env.DATABASE_URL);
  const sslMode = parsed.searchParams.get("sslmode");
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (isLocal) {
    record(
      "DATABASE_URL points at a remote host",
      "WARN",
      "localhost is not reachable from Vercel",
    );
  } else if (!sslMode) {
    record("DATABASE_URL enables TLS", "WARN", "add ?sslmode=require for managed providers");
  }

  // pg-connection-string warns about libpq SSL-mode semantics when sslmode is
  // in the URL. Handle TLS here and pass a clean connection string instead.
  const connectionUrl = new URL(env.DATABASE_URL);
  connectionUrl.searchParams.delete("sslmode");
  connectionUrl.searchParams.delete("channel_binding");

  const client = new pg.Client({
    connectionString: connectionUrl.toString(),
    connectionTimeoutMillis: 8_000,
    query_timeout: 8_000,
    ...(sslMode && sslMode !== "disable"
      ? { ssl: { rejectUnauthorized: sslMode === "verify-full" } }
      : {}),
  });

  try {
    await client.connect();
    const { rows } = await client.query(
      'select current_database() as database, current_user as "user", version() as version',
    );
    const version = String(rows[0]?.version ?? "")
      .split(" ")
      .slice(0, 2)
      .join(" ");
    record("PostgreSQL connection", "PASS", `${rows[0]?.database} as ${rows[0]?.user}, ${version}`);

    let applied = [];
    try {
      const migrations = await client.query(
        "select migration_name from _prisma_migrations where finished_at is not null",
      );
      applied = migrations.rows.map((row) => row.migration_name);
      record("Prisma migrations applied", "PASS", `${applied.length} applied`);
    } catch {
      record(
        "Prisma migrations applied",
        "FAIL",
        "the _prisma_migrations table is missing; run prisma migrate deploy",
      );
      return;
    }

    const migrationsDir = path.join(root, "apps/api/prisma/migrations");
    let localMigrations = [];
    try {
      localMigrations = readdirSync(migrationsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    } catch {
      record("Local Prisma migrations found", "WARN", `cannot read ${migrationsDir}`);
    }
    if (localMigrations.length > 0) {
      const appliedSet = new Set(applied);
      const pending = localMigrations.filter((name) => !appliedSet.has(name));
      if (pending.length === 0) {
        record("No pending migrations", "PASS", `${localMigrations.length} local migrations`);
      } else {
        record(
          "No pending migrations",
          "FAIL",
          `${pending.length} pending: ${pending.slice(0, 5).join(", ")}${pending.length > 5 ? ", ..." : ""}`,
        );
      }
    }
  } catch (error) {
    record("PostgreSQL connection", "FAIL", error.message);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function checkRedis() {
  if (!requireValue("REDIS_URL", env.REDIS_URL)) return;
  if (!/^rediss?:\/\//i.test(env.REDIS_URL)) {
    record("REDIS_URL is a Redis URL", "FAIL", "expected redis:// or rediss://");
    return;
  }

  const parsed = new URL(env.REDIS_URL);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (isLocal) {
    record("REDIS_URL points at a remote host", "WARN", "localhost is not reachable from Vercel");
  }
  if (parsed.protocol === "redis:" && !isLocal) {
    record("REDIS_URL uses TLS", "WARN", "prefer rediss:// for managed Redis");
  }

  const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 8_000,
    enableReadyCheck: true,
    retryStrategy: () => null,
  });

  try {
    await redis.connect();
    const pong = await redis.ping();
    let version = "";
    try {
      const info = await redis.info("server");
      version = info.match(/redis_version:([^\r\n]+)/)?.[1] ?? "";
    } catch {
      // Some managed Redis providers disable INFO.
    }
    record("Redis connection", "PASS", `${pong}${version ? `, redis ${version}` : ""}`);
  } catch (error) {
    record("Redis connection", "FAIL", error.message);
  } finally {
    redis.disconnect();
  }
}

async function checkStorage() {
  const configured =
    env.S3_REGION && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY;
  if (!configured) {
    record(
      "S3 storage is configured",
      "FAIL",
      "S3_REGION/S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY are required",
    );
    return;
  }
  if (isPlaceholder(env.S3_BUCKET) || isPlaceholder(env.S3_ACCESS_KEY_ID)) {
    record("S3 storage is configured", "FAIL", "placeholder value");
    return;
  }
  if (env.S3_ENDPOINT && isPlaceholder(env.S3_ENDPOINT)) {
    record("S3 storage is configured", "FAIL", "S3_ENDPOINT is a placeholder");
    return;
  }
  record("S3 storage is configured", "PASS");

  const client = new S3Client({
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT, forcePathStyle: true } : {}),
  });
  const bucket = env.S3_BUCKET;

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    record("S3 bucket is reachable", "PASS", bucket);
  } catch (error) {
    const detail =
      error?.$metadata?.httpStatusCode === 403
        ? "HeadBucket requires s3:ListBucket; add it to the bucket policy"
        : error.message;
    record("S3 bucket is reachable", "FAIL", detail);
    return;
  }

  const key = `_studioos/healthcheck/${Date.now()}-${randomUUID()}.txt`;
  const body = `StudioOS deployment check ${new Date().toISOString()}\n`;

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: "text/plain; charset=utf-8",
      }),
    );
    record("S3 PutObject", "PASS", key);
  } catch (error) {
    record("S3 PutObject", "FAIL", error.message);
    return;
  }

  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    record("S3 HeadObject", "PASS", `${head.ContentLength ?? 0} bytes`);
  } catch (error) {
    record("S3 HeadObject", "FAIL", error.message);
  }

  try {
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const text = await object.Body.transformToString();
    if (text === body) {
      record("S3 GetObject", "PASS");
    } else {
      record("S3 GetObject", "FAIL", "round-trip content mismatch");
    }
  } catch (error) {
    record("S3 GetObject", "FAIL", error.message);
  }

  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    record("S3 DeleteObject (cleanup)", "PASS");
  } catch (error) {
    record(
      "S3 DeleteObject (cleanup)",
      "WARN",
      `test object remains at ${key}; grant s3:DeleteObject or add a lifecycle rule (${error.name})`,
    );
  }

  try {
    const cors = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
    const origin = new URL(env.WEB_ORIGIN).origin;
    const rules = cors.CORSRules ?? [];
    const allowsOrigin = rules.some(
      (rule) =>
        rule.AllowedOrigins?.includes("*") ||
        rule.AllowedOrigins?.includes(origin) ||
        rule.AllowedOrigins?.includes(env.WEB_ORIGIN),
    );
    const localOrigin = ["localhost", "127.0.0.1"].includes(new URL(env.WEB_ORIGIN).hostname);
    const localEndpoint = env.S3_ENDPOINT
      ? ["localhost", "127.0.0.1"].includes(new URL(env.S3_ENDPOINT).hostname)
      : false;
    record(
      "S3 CORS allows WEB_ORIGIN",
      allowsOrigin ? "PASS" : localOrigin || localEndpoint ? "WARN" : "FAIL",
      allowsOrigin ? origin : `add ${origin} to AllowedOrigins`,
    );
  } catch (error) {
    record(
      "S3 CORS allows WEB_ORIGIN",
      "WARN",
      `cannot read bucket CORS; verify AllowedOrigins includes ${env.WEB_ORIGIN} (${error.name})`,
    );
  }
}

function emailFromParts() {
  const value = String(env.EMAIL_FROM ?? "").trim();
  const match = /^(.*?)\s*<([^<>]+)>$/.exec(value);
  return {
    name: match?.[1]?.trim() || "StudioOS",
    email: match?.[2]?.trim() || value,
  };
}

async function checkBrevo() {
  if (!requireValue("BREVO_API_KEY", env.BREVO_API_KEY)) return;
  if (!requireValue("EMAIL_FROM", env.EMAIL_FROM)) return;

  try {
    const account = await fetch("https://api.brevo.com/v3/account", {
      headers: { "api-key": env.BREVO_API_KEY },
      signal: AbortSignal.timeout(10_000),
    });
    const detail = redact((await account.text()).slice(0, 300));
    if (!account.ok) {
      record("Brevo API key", "FAIL", `HTTP ${account.status}: ${detail}`);
      return;
    }
    record("Brevo API key", "PASS");
  } catch (error) {
    record("Brevo API key", "FAIL", error.message);
    return;
  }

  if (!options.sendEmail) {
    record("Brevo test email", "SKIP", "pass --send-email you@example.com to send a real message");
    return;
  }

  try {
    const from = emailFromParts();
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: from,
        to: [{ email: options.sendEmail }],
        subject: "StudioOS external credential check",
        textContent: "This is a test message from the StudioOS deployment credential check.",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const detail = redact((await response.text()).slice(0, 500));
    if (!response.ok) {
      record("Brevo test email", "FAIL", `HTTP ${response.status}: ${detail}`);
      return;
    }
    let id = "";
    try {
      id = JSON.parse(detail).messageId ?? "";
    } catch {
      // ignore
    }
    record("Brevo test email", "PASS", id ? `id ${id}` : `HTTP ${response.status}`);
  } catch (error) {
    record("Brevo test email", "FAIL", error.message);
  }
}

async function checkSmtp() {
  if (!requireValue("SMTP_HOST", env.SMTP_HOST)) return;
  if (!requireValue("EMAIL_FROM", env.EMAIL_FROM)) return;
  if (env.SMTP_USER && !requireValue("SMTP_PASSWORD", env.SMTP_PASSWORD)) return;

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT ?? 587),
    secure: env.SMTP_SECURE === "true",
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? "" } } : {}),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  try {
    await transport.verify();
    record("SMTP connection", "PASS", `${env.SMTP_HOST}:${env.SMTP_PORT ?? 587}`);
  } catch (error) {
    record("SMTP connection", "FAIL", error.message);
    return;
  }

  if (!options.sendEmail) {
    record("SMTP test email", "SKIP", "pass --send-email you@example.com to send a real message");
    return;
  }

  try {
    const info = await transport.sendMail({
      from: env.EMAIL_FROM,
      to: options.sendEmail,
      subject: "StudioOS external credential check",
      text: "This is a test message from the StudioOS deployment credential check.",
    });
    record("SMTP test email", "PASS", info.messageId ? `id ${info.messageId}` : "sent");
  } catch (error) {
    record("SMTP test email", "FAIL", error.message);
  }
}

async function checkEmail() {
  if (!env.EMAIL_PROVIDER || env.EMAIL_PROVIDER === "console") {
    record(
      "Email provider",
      "SKIP",
      "EMAIL_PROVIDER=console; production should use resend, brevo, or smtp",
    );
    return;
  }
  if (env.EMAIL_PROVIDER === "brevo") {
    await checkBrevo();
    return;
  }
  if (env.EMAIL_PROVIDER === "smtp") {
    await checkSmtp();
    return;
  }
  if (env.EMAIL_PROVIDER !== "resend") {
    record("Email provider", "FAIL", `unsupported EMAIL_PROVIDER=${env.EMAIL_PROVIDER}`);
    return;
  }
  if (!requireValue("EMAIL_API_KEY", env.EMAIL_API_KEY)) return;
  if (!requireValue("EMAIL_FROM", env.EMAIL_FROM)) return;

  const fromMatch = env.EMAIL_FROM.match(/<([^>]+)>/) ?? [null, env.EMAIL_FROM];
  const fromAddress = fromMatch[1];
  const fromDomain = fromAddress.split("@")[1];
  const isTestSender = fromAddress === "onboarding@resend.dev";

  let domainsAvailable = false;
  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${env.EMAIL_API_KEY}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      domainsAvailable = true;
      const payload = await response.json();
      const domains = Array.isArray(payload?.data) ? payload.data : [];
      if (isTestSender) {
        record(
          "Resend sender domain",
          "WARN",
          "onboarding@resend.dev is the test sender; it only delivers to the Resend account owner. Verify a domain for production.",
        );
      } else {
        const match = domains.find((domain) => domain.name === fromDomain);
        if (!match) {
          record("Resend sender domain", "FAIL", `${fromDomain} is not added to Resend`);
        } else if (match.status === "verified") {
          record("Resend sender domain", "PASS", `${fromDomain} verified`);
        } else {
          record("Resend sender domain", "FAIL", `${fromDomain} status=${match.status}`);
        }
      }
    } else if (response.status === 401 || response.status === 403) {
      const detail = redact((await response.text()).slice(0, 300));
      record(
        "Resend API key",
        "WARN",
        `key cannot list domains (HTTP ${response.status}); sending-only keys are expected. Run with --send-email to validate: ${detail}`,
      );
    } else {
      const detail = redact((await response.text()).slice(0, 300));
      record("Resend API key", "WARN", `cannot list domains (HTTP ${response.status}): ${detail}`);
    }
  } catch (error) {
    record("Resend API key", "FAIL", error.message);
    return;
  }

  if (options.sendEmail) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.EMAIL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [options.sendEmail],
          subject: "StudioOS external credential check",
          text: "This is a test message from the StudioOS deployment credential check.",
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const text = redact((await response.text()).slice(0, 500));
      if (response.ok) {
        let id = "";
        try {
          id = JSON.parse(text).id ?? "";
        } catch {
          // ignore
        }
        record("Resend test email", "PASS", id ? `id ${id}` : `HTTP ${response.status}`);
      } else {
        record("Resend test email", "FAIL", `HTTP ${response.status}: ${text}`);
      }
    } catch (error) {
      record("Resend test email", "FAIL", error.message);
    }
  } else {
    record("Resend test email", "SKIP", "pass --send-email you@example.com to send a real message");
  }

  if (!domainsAvailable && !isTestSender) {
    record(
      "Resend sender domain",
      "WARN",
      "could not verify the sender domain with this key; the send test is authoritative",
    );
  }
}

async function checkWebhook() {
  if (!env.MONITORING_WEBHOOK_URL) {
    record("Monitoring webhook", "SKIP", "not set");
    return;
  }
  if (isPlaceholder(env.MONITORING_WEBHOOK_URL)) {
    record("Monitoring webhook", "FAIL", "placeholder value");
    return;
  }

  try {
    const response = await fetch(env.MONITORING_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service: "studioos",
        type: "studioos.healthcheck",
        text: "StudioOS external credential check",
        content: "StudioOS external credential check",
        occurredAt: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      record("Monitoring webhook", "PASS", `HTTP ${response.status}`);
    } else {
      const detail = redact((await response.text()).slice(0, 300));
      record(
        "Monitoring webhook",
        "FAIL",
        `HTTP ${response.status}: ${detail} (the endpoint may require a provider-specific payload)`,
      );
    }
  } catch (error) {
    record("Monitoring webhook", "FAIL", error.message);
  }
}

function checkWebOrigin() {
  if (!requireValue("WEB_ORIGIN", env.WEB_ORIGIN)) return;
  try {
    const url = new URL(env.WEB_ORIGIN);
    const localOrigin = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:") {
      record("WEB_ORIGIN uses HTTPS", localOrigin ? "WARN" : "FAIL", url.protocol);
    } else if (localOrigin) {
      record("WEB_ORIGIN uses HTTPS", "WARN", "local development origin");
    } else {
      record("WEB_ORIGIN uses HTTPS", "PASS", url.origin);
    }
  } catch {
    record("WEB_ORIGIN uses HTTPS", "FAIL", "invalid URL");
  }
}

async function main() {
  console.log(`External service check using ${path.relative(root, envPath)}`);
  console.log(`Database: ${safeHost(env.DATABASE_URL)}`);
  console.log(`Redis:    ${safeHost(env.REDIS_URL)}`);
  console.log(
    `S3:       ${env.S3_ENDPOINT || "AWS default endpoint"} / ${env.S3_BUCKET ?? "(missing)"}`,
  );
  console.log("");

  checkWebOrigin();
  await checkDatabase();
  await checkRedis();
  await checkStorage();
  await checkEmail();
  await checkWebhook();

  const failed = results.filter((entry) => entry.status === "FAIL");
  const warned = results.filter((entry) => entry.status === "WARN");
  console.log("");
  console.log(
    `${results.length - failed.length}/${results.length} checks passed` +
      `${warned.length ? `, ${warned.length} warning(s)` : ""}` +
      `${failed.length ? `, ${failed.length} failure(s)` : ""}.`,
  );
  if (failed.length > 0) {
    console.error(`Failed: ${failed.map((entry) => entry.name).join("; ")}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Credential check failed: ${redact(error.stack ?? error.message)}`);
  process.exitCode = 1;
});
