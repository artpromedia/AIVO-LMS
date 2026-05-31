/**
 * Drizzle-backed AuditStore (web_audit_logs). Append-only; `seq`
 * BIGSERIAL preserves the insertion order the memory store got from
 * array push. Reads are tenant-scoped, newest-first, capped to `limit`.
 */
import { desc, eq, inArray } from "drizzle-orm";
import { webAuditLogs } from "@aivo/db";
import type { AuditLog } from "@/lib/db/types";
import type { AuditStore } from "../types";
import { getDb } from "./client";

export const drizzleAudit: AuditStore = {
  async append(entry) {
    const db = getDb();
    await db.insert(webAuditLogs).values({ tenantId: entry.tenantId ?? null, data: entry });
    return entry;
  },

  async recentForTenant(tenantId, limit) {
    const db = getDb();
    const rows = await db
      .select()
      .from(webAuditLogs)
      .where(eq(webAuditLogs.tenantId, tenantId))
      .orderBy(desc(webAuditLogs.seq))
      .limit(limit);
    return rows.map((r) => r.data as AuditLog);
  },

  async recentForTenants(tenantIds, limit) {
    if (tenantIds.length === 0) return [];
    const db = getDb();
    const rows = await db
      .select()
      .from(webAuditLogs)
      .where(inArray(webAuditLogs.tenantId, tenantIds))
      .orderBy(desc(webAuditLogs.seq))
      .limit(limit);
    return rows.map((r) => r.data as AuditLog);
  },
};
