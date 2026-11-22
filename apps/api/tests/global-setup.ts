import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://studioos:studioos@localhost:5432/studio_os_test";

function assertTestDatabase(url: string): string {
  const parsed = new URL(url);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Refusing to run tests against "${databaseName}". The test database name must end in _test.`,
    );
  }
  return databaseName;
}

async function ensureDatabaseExists(databaseName: string): Promise<void> {
  const adminUrl = new URL(testDatabaseUrl);
  adminUrl.pathname = "/postgres";

  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      databaseName,
    ]);
    if (existing.rowCount === 0) {
      const safeName = databaseName.replace(/"/g, '""');
      await client.query(`CREATE DATABASE "${safeName}"`);
    }
  } finally {
    await client.end();
  }
}

export default async function globalSetup(): Promise<void> {
  const databaseName = assertTestDatabase(testDatabaseUrl);
  await ensureDatabaseExists(databaseName);

  execFileSync("npx", ["--no-install", "prisma", "migrate", "deploy"], {
    cwd: path.join(repoRoot, "apps/api"),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "inherit",
  });
}
