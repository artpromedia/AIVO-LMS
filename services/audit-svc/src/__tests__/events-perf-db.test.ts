/**
 * Sprint 3 — DB-backed perf test for the canonical event store.
 *
 * Targets pinned by the spec:
 *   • Query p95 < 500ms over 1M rows on a single-tenant filter.
 *   • Stream 50k rows in < 30s and roughly constant memory.
 *
 * This test is **env-gated** on `TEST_DATABASE_URL` because seeding 1M
 * audit rows takes minutes — we don't want it firing on every `pnpm test`
 * run. Wire it into a nightly or pre-deploy job by exporting the URL of
 * a disposable Postgres (e.g. `postgres://aivo:aivo@127.0.0.1:5432/audit_perf`)
 * that already has migration 0048 (`audit_events_v2`) applied.
 *
 * Run locally:
 *   TEST_DATABASE_URL=postgres://… pnpm --filter @aivo/audit-svc test events-perf-db
 *
 * The test cleans up after itself by `TRUNCATE`ing the table inside the
 * same connection on completion. It will not run against any URL whose
 * database name does not include `perf` or `test`, as a guardrail.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { createDb, auditEventsV2 } from "@aivo/db";
import type { AuditEventInput } from "@aivo/audit-client";
import { DrizzleEventStore } from "../services/drizzle-event-store.js";

const URL = process.env.TEST_DATABASE_URL;
const ENABLED = Boolean(URL);

// Seeding 1M rows is heavy; let CI override the row count downward when
// running against a slow disk, but production-gate runs should use 1M.
const N = Number(process.env.AUDIT_PERF_ROWS ?? "1000000");
const STREAM_N = Number(process.env.AUDIT_PERF_STREAM_ROWS ?? "50000");
const QUERY_SAMPLES = Number(process.env.AUDIT_PERF_QUERY_SAMPLES ?? "100");
const P95_BUDGET_MS = Number(process.env.AUDIT_PERF_P95_MS ?? "500");
const STREAM_BUDGET_MS = Number(process.env.AUDIT_PERF_STREAM_MS ?? "30000");

const describeFn = ENABLED ? describe : describe.skip;

describeFn("audit event store @ DB scale (1M rows)", () => {
  let db: ReturnType<typeof createDb>;
  let store: DrizzleEventStore;

  beforeAll(async () => {
    if (!URL) return;
    // Guardrail: refuse to wipe a non-disposable DB by accident.
    if (!/perf|test/i.test(URL)) {
      throw new Error(
        "TEST_DATABASE_URL must contain 'perf' or 'test' — refusing to run against possibly-real DB.",
      );
    }
    db = createDb(URL);
    store = new DrizzleEventStore(db);
    // Start from a clean slate so prior runs don't contaminate p95.
    await (db as any).execute(sql`TRUNCATE TABLE ${auditEventsV2}`);
  }, 120_000);

  afterAll(async () => {
    if (!ENABLED) return;
    try {
      await (db as any).execute(sql`TRUNCATE TABLE ${auditEventsV2}`);
    } catch {
      // Best-effort cleanup; perf DB is disposable.
    }
  }, 60_000);

  it(
    `appends ${N.toLocaleString()} rows then meets p95 < ${P95_BUDGET_MS}ms on tenant query`,
    async () => {
      // ── Seed phase ───────────────────────────────────────────────────────
      // Append in batches via the public API so hash-chain semantics match
      // production exactly. Batches of 1000 keep transaction overhead sane.
      const BATCH = 1000;
      const t0 = Date.now();
      for (let base = 0; base < N; base += BATCH) {
        // Sequential intra-batch (chain is serial), parallel across batches
        // would race the chain head — so we keep this strictly sequential.
        for (let i = 0; i < BATCH && base + i < N; i++) {
          const idx = base + i;
          const input: AuditEventInput = {
            occurred_at: new Date(1_700_000_000_000 + idx * 1000).toISOString(),
            tenant_id: idx % 4 === 0 ? "t-target" : `t-other-${idx % 8}`,
            actor: { id: `u${idx % 5000}`, role: "teacher", ip: "1.2.3.4", ua: "x" },
            action: "roster.user.updated",
            entity: { type: "user", id: `u${idx}` },
            outcome: "success",
            details: { idx, batch: base / BATCH },
            request_id: `r${idx}`,
          };
          await store.append(input);
        }
      }
      const seedMs = Date.now() - t0;
      // eslint-disable-next-line no-console
      console.log(`[perf] seed ${N} rows in ${(seedMs / 1000).toFixed(1)}s`);

      // ── Query phase ──────────────────────────────────────────────────────
      // 100 random tenant queries, default page size, sorted, p95 < 500ms.
      const samples: number[] = [];
      for (let i = 0; i < QUERY_SAMPLES; i++) {
        const q0 = Date.now();
        const page = await store.query({ tenantId: "t-target", limit: 50 });
        samples.push(Date.now() - q0);
        expect(page.events.length).toBeGreaterThan(0);
      }
      samples.sort((a, b) => a - b);
      const p50 = samples[Math.floor(samples.length * 0.5)];
      const p95 = samples[Math.floor(samples.length * 0.95)];
      const p99 = samples[Math.floor(samples.length * 0.99)];
      // eslint-disable-next-line no-console
      console.log(
        `[perf] query p50=${p50}ms p95=${p95}ms p99=${p99}ms over ${QUERY_SAMPLES} samples`,
      );
      expect(p95).toBeLessThan(P95_BUDGET_MS);
    },
    // Generous timeout — 1M serial appends + 100 queries.
    60 * 60_000,
  );

  it(
    `streams ${STREAM_N.toLocaleString()} rows in < ${STREAM_BUDGET_MS}ms with bounded memory`,
    async () => {
      const baselineMem = process.memoryUsage().heapUsed;
      const t0 = Date.now();
      let count = 0;
      let bytes = 0;
      let peakHeap = baselineMem;
      for await (const e of store.stream({ tenantId: "t-target" })) {
        bytes += JSON.stringify(e).length;
        count += 1;
        if (count % 5000 === 0) {
          peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed);
        }
        if (count >= STREAM_N) break;
      }
      const elapsed = Date.now() - t0;
      const heapGrowthMb = (peakHeap - baselineMem) / 1024 / 1024;
      // eslint-disable-next-line no-console
      console.log(
        `[perf] streamed ${count} rows, ${bytes} bytes, in ${elapsed}ms, heap growth ${heapGrowthMb.toFixed(1)}MB`,
      );
      expect(count).toBe(STREAM_N);
      expect(elapsed).toBeLessThan(STREAM_BUDGET_MS);
      // Memory should not balloon — generous 256MB ceiling above the
      // post-seed baseline (we don't normalize for V8 GC pacing).
      expect(heapGrowthMb).toBeLessThan(256);
    },
    10 * 60_000,
  );
});
