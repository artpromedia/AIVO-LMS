/**
 * Global setup for integration tests.
 * Starts test Postgres (via @testcontainers/postgresql), runs Drizzle
 * migrations, and starts all AIVO services.
 *
 * NOTE: These tests require Docker to be available in the environment.
 * In CI add `docker` as a service or use a Testcontainers-compatible runner.
 */
import { setup as setupDb } from "./db.js";
import { startAllServices, stopAllServices } from "./services.js";

export async function setup(): Promise<void> {
  await setupDb();
  await startAllServices();
}

export async function teardown(): Promise<void> {
  await stopAllServices();
}
