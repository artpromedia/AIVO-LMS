/**
 * Sprint 7 — watchdog tests. (Tasks #59, #68)
 *
 * v2.1 §9.1 dedup: the watchdog now uses `@aivo/ops-alerts` (durable outbox
 * + alerts-proxy-svc) wrapped in `LegacyOpsAlertClient`. Tests inject a stub
 * `send()` directly via `_setWatchdogAlertsForTest` instead of patching the
 * global `fetch`.
 */
import { test } from "node:test";
import assert from "node:assert";
import { runWatchdogOnce, _setWatchdogAlertsForTest } from "../src/lib/watchdog.js";

interface CapturedAlert {
  severity: string;
  title: string;
  body: string;
  dedupKey?: string;
  fields?: Record<string, unknown>;
}

function makeFakeDb(rows: any[]) {
  return {
    execute: async () => ({ rows }),
  };
}

function makeStubAlerts() {
  const calls: CapturedAlert[] = [];
  const client = {
    async send(alert: CapturedAlert) {
      calls.push(alert);
      return { delivered: true, deduped: false };
    },
  };
  return { client, calls };
}

test("alerts when a registered job has never run", async () => {
  const { client, calls } = makeStubAlerts();
  _setWatchdogAlertsForTest(client);
  try {
    const db = makeFakeDb([]);
    const result = await runWatchdogOnce(db);
    assert.ok(result.alerted.length > 0, "expected at least one job to be alerted");
    assert.ok(calls.length > 0, "expected at least one alert send");
    for (const c of calls) {
      assert.ok(c.dedupKey, `alert ${c.title} missing dedupKey`);
      assert.ok((c.dedupKey ?? "").startsWith("job-stale:"), "dedupKey shape preserved");
    }
  } finally {
    _setWatchdogAlertsForTest(null);
  }
});

test("does not alert when every job is fresh", async () => {
  const { client, calls } = makeStubAlerts();
  _setWatchdogAlertsForTest(client);
  try {
    const now = new Date();
    const { JOB_REGISTRY } = await import("@aivo/scheduling");
    const rows = JOB_REGISTRY.map((j) => ({
      job_name: j.jobName,
      last_run_at: now,
      last_finished_at: now,
      last_status: "ok",
    }));
    const db = makeFakeDb(rows);
    const result = await runWatchdogOnce(db);
    assert.equal(result.alerted.length, 0);
    assert.equal(calls.length, 0);
  } finally {
    _setWatchdogAlertsForTest(null);
  }
});

test("watchdog tick does not crash when no alerts client is configured", async () => {
  // Defensive default: an unconfigured admin-svc must still complete a tick.
  _setWatchdogAlertsForTest(null);
  const db = makeFakeDb([]);
  const result = await runWatchdogOnce(db);
  // Stale jobs are still reported in the return value; we just don't page.
  assert.ok(Array.isArray(result.alerted));
});
