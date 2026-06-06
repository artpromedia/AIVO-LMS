import "server-only";

import { adminGet } from "./client";
import { type AdminAuditEntry, adminRoleLabel } from "./types";
import type { SessionProfile } from "@aivo/admin-auth/types";

export async function listAdminAuditLogs(
  session: Pick<SessionProfile, "role">,
  limit = 100,
): Promise<AdminAuditEntry[]> {
  const pageSize = Math.min(Math.max(1, limit), 100);
  const totalPages = Math.ceil(limit / pageSize);
  const entries: AdminAuditEntry[] = [];

  for (let page = 1; page <= totalPages; page += 1) {
    const payload = await adminGet<Record<string, unknown>>(session, "/api/admin-svc/audit-log", {
      page,
      pageSize,
    });
    const rows = Array.isArray(payload.entries) ? payload.entries : [];
    for (const row of rows) {
      if (entries.length >= limit) break;
      const item = row as Record<string, unknown>;
      const actorRole = String(item.actorRole ?? "UNKNOWN");
      entries.push({
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
      });
    }
    if (rows.length < pageSize) break;
  }

  return entries;
}
