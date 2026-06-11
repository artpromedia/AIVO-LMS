import "server-only";

import { createReadDedupe } from "@aivo/audit-client";
import { adminGet, adminPost } from "./client";
import { type AdminAuditEntry, adminRoleLabel } from "./types";
import type { SessionProfile } from "@aivo/admin-auth/types";

/** Sprint B3 — one real page of the audit log (server-driven table). */
export interface AuditLogPage {
  rows: AdminAuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listAdminAuditLogsPage(
  session: Pick<SessionProfile, "role">,
  opts: { page?: number; pageSize?: number; search?: string; sort?: "createdAt:asc" | "createdAt:desc" } = {},
): Promise<AuditLogPage> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(Math.max(1, opts.pageSize ?? 50), 100);
  const payload = await adminGet<Record<string, unknown>>(session, "/api/admin-svc/audit-log", {
    page,
    pageSize,
    ...(opts.search ? { search: opts.search } : {}),
    ...(opts.sort ? { sort: opts.sort } : {}),
  });
  const rowsRaw = Array.isArray(payload.entries) ? payload.entries : [];
  const rows = rowsRaw.map((row) => {
    const item = row as Record<string, unknown>;
    const actorRole = String(item.actorRole ?? "UNKNOWN");
    return {
      id: String(item.id),
      action: String(item.action ?? "unknown"),
      actorId: String(item.actorId ?? ""),
      actorEmail: String(item.actorEmail ?? ""),
      actorRole,
      actorRoleLabel: adminRoleLabel(actorRole),
      resourceType: String(item.resourceType ?? "unknown"),
      resourceId: item.resourceId ? String(item.resourceId) : null,
      tenantId: item.tenantId ? String(item.tenantId) : null,
      createdAt: String(item.createdAt ?? new Date(0).toISOString()),
    };
  });
  return { rows, total: Number(payload.total ?? rows.length), page, pageSize };
}

// ── Sprint B4 — sensitive-READ events ──────────────────────────────────
// Detail pages that render PII report each view so "who viewed this
// child's data, when" is answerable. Events are appended hash-chained by
// admin-svc; this side only pre-dedupes (same window as the server) so a
// page refresh doesn't even cost a request.

export type AdminReadAction = "admin.user.viewed" | "admin.learner.viewed" | "admin.dsar.viewed";

export interface AdminReadEvent {
  action: AdminReadAction;
  resourceType: "user" | "learner" | "dsar_request";
  resourceId: string;
  /** The viewed resource's tenant — routes the district-visible copy. */
  tenantId?: string | null;
}

const readEventDedupe = createReadDedupe();

/**
 * Best-effort by design: a failed audit write is logged, never thrown —
 * an audit outage must not take the admin console down with it.
 */
export async function recordAdminReadEvents(
  session: Pick<SessionProfile, "role" | "userId">,
  events: readonly AdminReadEvent[],
): Promise<void> {
  const fresh = events.filter((event) =>
    readEventDedupe.shouldEmit(
      session.userId ?? "",
      event.action,
      event.resourceType,
      event.resourceId,
    ),
  );
  if (fresh.length === 0) return;
  try {
    await adminPost(session, "/api/admin-svc/audit-log/read-events", { events: fresh });
  } catch (error) {
    console.error("[admin-api] read-event audit failed (page unaffected)", error);
  }
}
