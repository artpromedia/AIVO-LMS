import { randomUUID } from "node:crypto";
import { redactAuditMetadata } from "./audit-redaction.js";

export interface AuditEventInput {
  tenantId?: string;
  actorId?: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  learnerId?: string;
  beforeHash?: string;
  afterHash?: string;
  reason?: string;
  ipHash?: string;
  userAgentHash?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditEventRecord extends Omit<AuditEventInput, "metadata"> {
  id: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface AuditStore {
  append(input: AuditEventInput): Promise<AuditEventRecord>;
  list(filter?: {
    tenantId?: string;
    learnerId?: string;
    action?: string;
  }): Promise<AuditEventRecord[]>;
  countByAction(): Promise<Record<string, number>>;
}

export class InMemoryAuditStore implements AuditStore {
  private events: AuditEventRecord[] = [];

  async append(input: AuditEventInput): Promise<AuditEventRecord> {
    const record: AuditEventRecord = {
      id: randomUUID(),
      occurredAt: new Date().toISOString(),
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
      metadata: redactAuditMetadata(input.metadata),
    };
    this.events.push(record);
    return record;
  }

  async list(
    filter: { tenantId?: string; learnerId?: string; action?: string } = {},
  ): Promise<AuditEventRecord[]> {
    return this.events.filter((event) => {
      if (filter.tenantId && event.tenantId !== filter.tenantId) return false;
      if (filter.learnerId && event.learnerId !== filter.learnerId) return false;
      if (filter.action && event.action !== filter.action) return false;
      return true;
    });
  }

  async countByAction(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const event of this.events) {
      counts[event.action] = (counts[event.action] ?? 0) + 1;
    }
    return counts;
  }
}
