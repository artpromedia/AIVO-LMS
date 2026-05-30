/**
 * In-memory AuditStore — wraps the `auditLogs` array in the legacy
 * Map store. Default implementation; selected when
 * AIVO_PERSISTENCE_AUDIT=memory (the default).
 *
 * The audit array is append-only by convention. Reads are tenant-scoped
 * and return most-recent-first.
 */
import { getStore } from "@/lib/db/store";
import type { AuditStore } from "../types";

export const memoryAudit: AuditStore = {
  async append(entry) {
    getStore().auditLogs.push(entry);
    return entry;
  },
  async recentForTenant(tenantId, limit) {
    return getStore()
      .auditLogs.filter((l) => l.tenantId === tenantId)
      .slice(-limit)
      .reverse();
  },
  async recentForTenants(tenantIds, limit) {
    const ids = new Set(tenantIds);
    return getStore()
      .auditLogs.filter((l) => (l.tenantId ? ids.has(l.tenantId) : false))
      .slice(-limit)
      .reverse();
  },
};
