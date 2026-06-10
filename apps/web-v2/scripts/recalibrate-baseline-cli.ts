/**
 * CLI entrypoint for the baseline recalibration job (adaptive-learning E2E
 * Sprint 7). The job code existed (lib/jobs/recalibrate-baseline.ts) but had
 * no scheduled invocation; this entry + the weekly GitHub Actions workflow
 * (.github/workflows/baseline-recalibration.yml) close that gap.
 *
 * What it does: for every tenant with captured adaptive-baseline telemetry
 * (web_baseline_telemetry), recompute per-item difficulty/discrimination
 * health and the active calibration map, and emit a structured run summary.
 * NOTE on persistence: the calibration map is DERIVED — `
 * getBaselineCalibrationMap` recomputes it from the durable telemetry on
 * every read (the adaptive runner consumes it live), so the telemetry rows
 * are the persisted calibration source of truth; this job validates them
 * and snapshots operator-facing stats.
 *
 * Run from apps/web-v2 with the persistence layer forced to Postgres:
 *
 *   AIVO_PERSISTENCE=postgres DATABASE_URL=postgres://… \
 *     pnpm exec tsx scripts/recalibrate-baseline-cli.ts [--min-exposure=20]
 *
 * Exits non-zero when the job cannot run (no DATABASE_URL in postgres mode,
 * or the telemetry scan fails) so the scheduled workflow surfaces failures.
 */
import { sql } from "drizzle-orm";
import { createDb } from "@aivo/db";
import { runBaselineRecalibrationJob } from "../lib/jobs/recalibrate-baseline";

function parseMinExposure(): number | undefined {
  const arg = process.argv.find((a) => a.startsWith("--min-exposure="));
  if (!arg) return undefined;
  const value = Number(arg.split("=")[1]);
  if (!Number.isFinite(value) || value < 1) {
    console.error(`Invalid --min-exposure value: ${arg}`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "DATABASE_URL is required — the recalibration job reads the durable " +
        "web_baseline_telemetry table.",
    );
    process.exit(1);
  }
  // Tenants are discovered from the telemetry itself: a tenant with no
  // captured items has nothing to recalibrate.
  const db = createDb(url);
  const result = (await db.execute(
    sql`SELECT DISTINCT tenant_id FROM web_baseline_telemetry`,
  )) as unknown as { rows?: Array<{ tenant_id: string }> } | Array<{ tenant_id: string }>;
  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  const tenantIds = rows.map((r) => r.tenant_id).filter(Boolean);

  if (tenantIds.length === 0) {
    console.log(
      JSON.stringify({ event: "baseline.recalibration_job", tenants: 0, note: "no telemetry" }),
    );
    return;
  }

  const summary = await runBaselineRecalibrationJob({
    tenantIds,
    minExposure: parseMinExposure(),
  });
  console.log(JSON.stringify({ event: "baseline.recalibration_job", ...summary }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
