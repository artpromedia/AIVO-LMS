/**
 * Test database helper.
 *
 * Spins up a Postgres container via @testcontainers/postgresql, runs all
 * Drizzle migrations against it, and exports the connection URL so that
 * services and fixtures can use it.
 *
 * Requires Docker to be available. Falls back to TEST_DATABASE_URL env var
 * for environments (e.g. CI with a Postgres service) that pre-provision the DB.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");

let _dbUrl: string | null = null;
let _container: { stop(): Promise<void> } | null = null;

export function getDbUrl(): string {
  if (!_dbUrl) throw new Error("DB not initialized — call setup() first");
  return _dbUrl;
}

export async function setup(): Promise<void> {
  if (process.env.TEST_DATABASE_URL) {
    _dbUrl = process.env.TEST_DATABASE_URL;
    console.log("[integration/db] Using TEST_DATABASE_URL:", _dbUrl);
  } else {
    try {
      // @testcontainers/postgresql may not be installed; handle gracefully.
      const { PostgreSqlContainer } = await import("@testcontainers/postgresql" as any);
      const container = await new PostgreSqlContainer("postgres:16-alpine")
        .withDatabase("aivo_test")
        .withUsername("aivo")
        .withPassword("aivo_test_pw")
        .start();
      _dbUrl = container.getConnectionUri();
      _container = container;
      console.log("[integration/db] Container started:", _dbUrl);
    } catch (err) {
      console.warn(
        "[integration/db] @testcontainers/postgresql not available; falling back to localhost postgres",
      );
      _dbUrl = "postgresql://aivo:aivo_test_pw@localhost:5432/aivo_test";
    }
  }

  // Run Drizzle migrations.
  process.env.DATABASE_URL = _dbUrl;
  try {
    execSync("pnpm --filter @aivo/db db:migrate", {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: _dbUrl },
      stdio: "inherit",
    });
  } catch (err) {
    console.error("[integration/db] Migration failed:", err);
    throw err;
  }
}

export async function teardown(): Promise<void> {
  await _container?.stop();
  _container = null;
  _dbUrl = null;
}
