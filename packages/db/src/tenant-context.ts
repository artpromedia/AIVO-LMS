/**
 * Sprint 14 — tenant context for Postgres row-level security.
 *
 * The RLS policies added in migration 0106 scope reads/writes on the core
 * tenant tables to `current_setting('app.tenant_id')` for the non-bypassing
 * `app_runtime` role. This module is the ONLY supported way to establish
 * that setting:
 *
 *   withTenantContext(db, tenantId, fn)
 *     opens a transaction, applies `SET LOCAL app.tenant_id = <uuid>`, and
 *     runs `fn(tx)` inside it. SET LOCAL is transaction-scoped, so the
 *     setting can never leak across pooled connections — when the
 *     transaction ends (commit or rollback) the connection returns to the
 *     pool with no tenant attached, and an unscoped query on app_runtime
 *     sees zero rows.
 *
 *   withoutTenantContext(db, reason, fn)
 *     the loud, explicit escape hatch for platform-scoped work (cross-
 *     tenant maintenance, platform admin reads on a service that normally
 *     runs scoped). It does NOT bypass RLS — on app_runtime an RLS table
 *     still yields zero rows — it exists so call sites that intentionally
 *     run without a tenant are greppable and carry a logged reason.
 *
 * Rollout model: table owners (the migration role) are unaffected by RLS
 * without FORCE, so services still on the owner connection behave exactly
 * as before. A service adopts enforcement by switching DATABASE_URL to
 * app_runtime and threading withTenantContext — see
 * docs/security/rls-rollout.md.
 */
import { sql } from "drizzle-orm";
import type { createDb } from "./index.js";

type Database = ReturnType<typeof createDb>;

/** The transaction handle `withTenantContext` hands to its callback. */
export type TenantTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Run `fn` inside a transaction with `app.tenant_id` set for RLS.
 *
 * `opts.userId` additionally sets `app.user_id`, which the
 * `learners_collaboration_read` policy uses to make learners visible to
 * their ACCEPTED cross-tenant team members (teacher/caregiver/therapist
 * links) — family collaboration is cross-tenant BY DESIGN, and that
 * visibility is granted per accepted link, not per tenant.
 *
 * Ids are validated as UUIDs before interpolation — they reach SQL as
 * quoted literals because SET LOCAL does not take bind parameters.
 */
export async function withTenantContext<T>(
  db: Database,
  tenantId: string,
  fn: (tx: TenantTransaction) => Promise<T>,
  opts: { userId?: string } = {},
): Promise<T> {
  if (!UUID_RE.test(tenantId)) {
    throw new Error(`withTenantContext: tenantId must be a UUID, got ${JSON.stringify(tenantId)}`);
  }
  if (opts.userId !== undefined && !UUID_RE.test(opts.userId)) {
    throw new Error(`withTenantContext: userId must be a UUID, got ${JSON.stringify(opts.userId)}`);
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL app.tenant_id = '${tenantId}'`));
    if (opts.userId) {
      await tx.execute(sql.raw(`SET LOCAL app.user_id = '${opts.userId}'`));
    }
    return fn(tx);
  });
}

/**
 * Run `fn` in a transaction explicitly WITHOUT a tenant context.
 *
 * On the app_runtime role, RLS-protected tables return zero rows here —
 * use this only for work that genuinely doesn't touch tenant rows (or
 * runs on the owner connection). The reason is mandatory and logged so
 * unscoped data access stays auditable in service logs.
 */
export async function withoutTenantContext<T>(
  db: Database,
  reason: string,
  fn: (tx: TenantTransaction) => Promise<T>,
  log: { warn: (obj: Record<string, unknown>, msg: string) => void } = {
    warn: (obj, msg) => console.warn(msg, obj),
  },
): Promise<T> {
  if (!reason.trim()) {
    throw new Error("withoutTenantContext: a non-empty reason is required");
  }
  log.warn({ reason }, "[tenant-context] running WITHOUT tenant scope");
  return db.transaction(async (tx) => fn(tx));
}
