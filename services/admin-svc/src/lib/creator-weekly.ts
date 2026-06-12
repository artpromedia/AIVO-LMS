/**
 * Remediation Sprint 06 — the Sunday-night Creator job.
 *
 * `creator.weekly-generation` runs on a WeeklySchedule SafeCron (Sunday
 * 23:00, fleet-leader-elected like every admin-svc job) and drives lesson
 * PRE-GENERATION: it enumerates the tenants in this deployment and calls
 * web-v2's internal creator route, which generates each active learner's
 * next playable lesson as a `ready` LessonRun through the REAL production
 * path (brain gate → authored content → strict schema → persistence).
 *
 * The generation deliberately stays inside web-v2 — the lesson generator and
 * mission-selection logic live there and must not be forked into a worker;
 * this job owns only the WHEN (Sunday night, exactly once, fleet-safe) and
 * the tenant fan-out. Fail-closed: without WEB_V2_INTERNAL_URL +
 * INTERNAL_SERVICE_TOKEN the job reports failed with a precise reason
 * instead of pretending to run.
 */
import { sql } from "drizzle-orm";
import type { JobOutcome } from "@aivo/scheduling";

type DbLike = {
  execute(query: unknown): Promise<unknown>;
};

export interface CreatorWeeklyDeps {
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  webV2InternalUrl?: string;
  internalServiceToken?: string;
}

interface PregenerateResponse {
  ok?: boolean;
  data?: {
    scanned: number;
    generated: number;
    skippedExistingRun: number;
    skippedNoPath: number;
    skippedNotReady: number;
    failed: number;
  };
}

/** Tenant ids with at least one learner — the Creator's fan-out set. */
export async function listActiveTenantIds(db: DbLike): Promise<string[]> {
  const result = (await db.execute(
    sql`SELECT DISTINCT tenant_id FROM learners LIMIT 500`,
  )) as { rows?: Array<{ tenant_id: string }> } | Array<{ tenant_id: string }>;
  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  return rows.map((r) => r.tenant_id).filter(Boolean);
}

export async function runCreatorWeeklyOnce(
  db: DbLike,
  deps: CreatorWeeklyDeps = {},
): Promise<JobOutcome> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const baseUrl = deps.webV2InternalUrl ?? process.env.WEB_V2_INTERNAL_URL;
  const token = deps.internalServiceToken ?? process.env.INTERNAL_SERVICE_TOKEN;
  if (!baseUrl || !token) {
    return {
      status: "failed",
      errors: 1,
      sent: 0,
      failed: 1,
    };
  }
  let tenantIds: string[];
  try {
    tenantIds = await listActiveTenantIds(db);
  } catch {
    return { status: "failed", errors: 1, sent: 0, failed: 1 };
  }
  if (tenantIds.length === 0) return { status: "ok", sent: 0, failed: 0 };

  let generated = 0;
  let failed = 0;
  // Batch tenants so one request never carries more than the route's cap.
  const BATCH = 25;
  for (let i = 0; i < tenantIds.length; i += BATCH) {
    const batch = tenantIds.slice(i, i + BATCH);
    try {
      const res = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/api/internal/creator/pregenerate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-service-token": token,
        },
        body: JSON.stringify({ tenantIds: batch }),
      });
      if (!res.ok) {
        failed += batch.length;
        continue;
      }
      const body = (await res.json()) as PregenerateResponse;
      generated += body.data?.generated ?? 0;
      failed += body.data?.failed ?? 0;
    } catch {
      failed += batch.length;
    }
  }
  return {
    status: failed === 0 ? "ok" : generated > 0 ? "partial" : "failed",
    sent: generated,
    failed,
  };
}
