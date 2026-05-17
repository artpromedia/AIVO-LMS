/**
 * Drizzle-backed implementation of `AuditStore` against the
 * `enterprise_audit_events` table in `@aivo/db`. Sensitive metadata is
 * still scrubbed by `redactAuditMetadata` before persistence.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "@aivo/db";
import { enterpriseAuditEvents } from "@aivo/db";
import { redactAuditMetadata } from "./audit-redaction.js";
import type { AuditEventInput, AuditEventRecord, AuditStore } from "./audit-store.js";

function toRecord(row: typeof enterpriseAuditEvents.$inferSelect): AuditEventRecord {
  return {
    id: row.id,
    tenantId: row.tenantId ?? undefined,
    actorId: row.actorId ?? undefined,
    actorRole: row.actorRole,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId ?? undefined,
    learnerId: row.learnerId ?? undefined,
    beforeHash: row.beforeHash ?? undefined,
    afterHash: row.afterHash ?? undefined,
    reason: row.reason ?? undefined,
    ipHash: row.ipHash ?? undefined,
    userAgentHash: row.userAgentHash ?? undefined,
    metadata: (row.metadataJson as Record<string, unknown>) ?? {},
    occurredAt: (row.occurredAt ?? new Date()).toISOString(),
  };
}

export class DrizzleAuditStore implements AuditStore {
  constructor(private readonly db: Database) {}

  async append(input: AuditEventInput): Promise<AuditEventRecord> {
    const [row] = await this.db
      .insert(enterpriseAuditEvents)
      .values({
        tenantId: input.tenantId,
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        learnerId: input.learnerId,
        beforeHash: input.beforeHash,
        afterHash: input.afterHash,
        reason: input.reason,
        ipHash: input.ipHash,
        userAgentHash: input.userAgentHash,
        metadataJson: redactAuditMetadata(input.metadata),
      })
      .returning();
    return toRecord(row);
  }

  async list(
    filter: { tenantId?: string; learnerId?: string; action?: string } = {},
  ): Promise<AuditEventRecord[]> {
    const conditions = [];
    if (filter.tenantId) conditions.push(eq(enterpriseAuditEvents.tenantId, filter.tenantId));
    if (filter.learnerId) conditions.push(eq(enterpriseAuditEvents.learnerId, filter.learnerId));
    if (filter.action) conditions.push(eq(enterpriseAuditEvents.action, filter.action));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const query = this.db.select().from(enterpriseAuditEvents);
    const rows = where
      ? await query.where(where).orderBy(desc(enterpriseAuditEvents.occurredAt))
      : await query.orderBy(desc(enterpriseAuditEvents.occurredAt));
    return rows.map(toRecord);
  }

  async countByAction(): Promise<Record<string, number>> {
    const rows = await this.db
      .select({
        action: enterpriseAuditEvents.action,
        count: sql<number>`count(*)::int`,
      })
      .from(enterpriseAuditEvents)
      .groupBy(enterpriseAuditEvents.action);
    const out: Record<string, number> = {};
    for (const row of rows) {
      out[row.action] = Number(row.count);
    }
    return out;
  }
}
