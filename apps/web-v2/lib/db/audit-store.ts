/**
 * Audit feed mock store (Sprint 3).
 *
 * In-memory stand-in for audit-svc's `/events` query surface, mirroring its
 * canonical event shape so the BFF can later proxy to the real service
 * unchanged. Seeded with representative Sprint 1 (identity/MFA/SCIM) and
 * Sprint 2 (SIS) actions so the feed has content and the DoD ("all Sprint 1
 * and Sprint 2 actions appear") is demonstrable.
 */
import type { ISODate } from "@/lib/db/types";

export type AuditOutcome = "success" | "failure";

export type AuditEventView = {
  id: string;
  occurred_at: ISODate;
  tenant_id: string | null;
  /** School dimension for school-scoped views (null = district/global). */
  school_id: string | null;
  actor: { id: string; role: string; ip: string; ua: string };
  action: string;
  entity: { type: string; id: string };
  outcome: AuditOutcome;
  details: Record<string, unknown>;
  request_id: string;
  prev_hash: string;
  hash: string;
};

export type AuditFilter = {
  tenantId?: string;
  schoolId?: string;
  actorId?: string;
  actorRole?: string;
  action?: string[];
  entityType?: string;
  from?: string;
  to?: string;
  q?: string;
  cursor?: string;
  limit?: number;
};

declare global {
  var __aivoAuditStore: AuditEventView[] | undefined;
}

function db(): AuditEventView[] {
  if (!globalThis.__aivoAuditStore) globalThis.__aivoAuditStore = seed();
  return globalThis.__aivoAuditStore;
}

function matches(e: AuditEventView, f: AuditFilter): boolean {
  if (f.tenantId && e.tenant_id !== f.tenantId) return false;
  if (f.schoolId && e.school_id !== f.schoolId) return false;
  if (f.actorId && e.actor.id !== f.actorId) return false;
  if (f.actorRole && e.actor.role !== f.actorRole) return false;
  if (f.action && f.action.length && !f.action.includes(e.action)) return false;
  if (f.entityType && e.entity.type !== f.entityType) return false;
  if (f.from && e.occurred_at < f.from) return false;
  if (f.to && e.occurred_at > f.to) return false;
  if (f.q && !JSON.stringify(e.details).toLowerCase().includes(f.q.toLowerCase())) return false;
  return true;
}

export function queryAudit(f: AuditFilter): {
  events: AuditEventView[];
  nextCursor: string | null;
} {
  const limit = Math.min(f.limit ?? 50, 1000);
  const all = db()
    .filter((e) => matches(e, f))
    .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1)); // newest first
  const start = f.cursor ? all.findIndex((e) => e.id === f.cursor) + 1 : 0;
  const page = all.slice(start, start + limit);
  const nextCursor = start + limit < all.length ? (page[page.length - 1]?.id ?? null) : null;
  return { events: page, nextCursor };
}

export function getAuditEvent(
  id: string,
): {
  event: AuditEventView;
  proof: { prev_hash: string; hash: string; next_hash: string | null };
} | null {
  const all = db()
    .slice()
    .sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : 1)); // chain order
  const idx = all.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  const event = all[idx];
  return {
    event,
    proof: { prev_hash: event.prev_hash, hash: event.hash, next_hash: all[idx + 1]?.hash ?? null },
  };
}

/** Distinct actions within scope, for the filter-bar multi-select. */
export function listAuditActions(scope?: { tenantId?: string; schoolId?: string }): string[] {
  const set = new Set<string>();
  for (const e of db()) {
    if (scope?.tenantId && e.tenant_id !== scope.tenantId) continue;
    if (scope?.schoolId && e.school_id !== scope.schoolId) continue;
    set.add(e.action);
  }
  return [...set].sort();
}

function ev(
  i: number,
  over: Partial<AuditEventView> & Pick<AuditEventView, "action" | "actor" | "entity">,
): AuditEventView {
  const occurred = new Date(Date.now() - i * 3_600_000).toISOString();
  const prev = `${"0".repeat(63)}${(i % 10).toString(16)}`;
  return {
    id: `aud_${String(i).padStart(4, "0")}`,
    occurred_at: occurred,
    tenant_id: over.tenant_id ?? "t_district_demo",
    school_id: over.school_id ?? null,
    outcome: over.outcome ?? "success",
    details: over.details ?? {},
    request_id: `req_${i}`,
    prev_hash: prev,
    hash: `${"a".repeat(63)}${(i % 10).toString(16)}`,
    ...over,
  };
}

function seed(): AuditEventView[] {
  const platform = {
    id: "u_platform",
    role: "platform_admin",
    ip: "203.0.113.7",
    ua: "Mozilla/5.0",
  };
  const district = {
    id: "u_district",
    role: "district_admin",
    ip: "198.51.100.4",
    ua: "Mozilla/5.0",
  };
  const school = { id: "u_school", role: "school_admin", ip: "198.51.100.9", ua: "Mozilla/5.0" };
  return [
    // Sprint 1 — identity / MFA / SCIM
    ev(1, {
      action: "identity.idp.create",
      actor: platform,
      entity: { type: "idp", id: "idp_okta" },
      details: { protocol: "saml" },
      tenant_id: "t_district_demo",
    }),
    ev(2, {
      action: "identity.scim_token.issue",
      actor: district,
      entity: { type: "scim_token", id: "tok_1" },
      details: {},
    }),
    ev(3, {
      action: "mfa.totp.enrolled",
      actor: district,
      entity: { type: "user", id: "u_district" },
      details: {},
    }),
    ev(4, {
      action: "mfa.step_up.verify",
      actor: platform,
      entity: { type: "user", id: "u_platform" },
      outcome: "failure",
      details: { result: "failure" },
      tenant_id: null,
    }),
    ev(5, {
      action: "identity.idp.update",
      actor: platform,
      entity: { type: "idp", id: "idp_okta" },
      details: { enabled: true },
    }),
    // Sprint 2 — SIS
    ev(6, {
      action: "sis.connector.create",
      actor: district,
      entity: { type: "sis_connector", id: "sis_demo" },
      details: { provider: "oneroster_rest" },
    }),
    ev(7, {
      action: "sis.sync.trigger",
      actor: district,
      entity: { type: "sis_connector", id: "sis_demo" },
      details: { type: "full", status: "success" },
    }),
    ev(8, {
      action: "sis.errors.retry",
      actor: district,
      entity: { type: "sis_connector", id: "sis_demo" },
      details: { retried: 1 },
    }),
    // School-scoped
    ev(9, {
      action: "identity.user.role.granted",
      actor: school,
      entity: { type: "user", id: "u_teacher_1" },
      school_id: "t_school_demo",
      details: { role: "teacher" },
    }),
    ev(10, {
      action: "sis.sync.trigger",
      actor: district,
      entity: { type: "sis_connector", id: "sis_demo" },
      outcome: "failure",
      details: { type: "delta", status: "paused" },
    }),
  ];
}

export function _resetAuditStore(): void {
  globalThis.__aivoAuditStore = undefined;
}
