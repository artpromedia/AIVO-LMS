/**
 * Drizzle-backed AuditStore — stub.
 *
 * `packages/db` does not yet ship an `audit_logs` schema. When it
 * does (see ADR 0007 step 2), the implementation looks like:
 *
 *   import { db, schema } from "@aivo/db";
 *   export const drizzleAudit: AuditStore = {
 *     async append(entry) {
 *       await db.insert(schema.auditLogs).values(entry);
 *       return entry;
 *     },
 *     async recentForTenant(tenantId, limit) {
 *       return db
 *         .select()
 *         .from(schema.auditLogs)
 *         .where(eq(schema.auditLogs.tenantId, tenantId))
 *         .orderBy(desc(schema.auditLogs.occurredAt))
 *         .limit(limit);
 *     },
 *     ...
 *   };
 *
 * Until then, callers that flip AIVO_PERSISTENCE_AUDIT=postgres hit
 * the explicit error below.
 */
import type { AuditStore } from "../types";

function notImplemented(method: string): never {
  throw new Error(
    `[persistence.drizzle.audit.${method}] not implemented. ` +
      `Land the audit_logs schema in packages/db before flipping ` +
      `AIVO_PERSISTENCE_AUDIT=postgres.`,
  );
}

export const drizzleAudit: AuditStore = {
  async append() {
    return notImplemented("append");
  },
  async recentForTenant() {
    return notImplemented("recentForTenant");
  },
  async recentForTenants() {
    return notImplemented("recentForTenants");
  },
};
