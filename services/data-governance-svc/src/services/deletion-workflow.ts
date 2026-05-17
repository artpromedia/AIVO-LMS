import { randomUUID } from "node:crypto";

export interface RetentionHold {
  districtId: string;
  reason: string;
  expiresAt?: string;
}

export type DeletionStatus =
  | "PENDING_REVIEW"
  | "BLOCKED_BY_RETENTION_HOLD"
  | "SOFT_DELETED"
  | "READY_FOR_HARD_DELETE"
  | "HARD_DELETED"
  | "CANCELLED";

export interface DeletionRequest {
  id: string;
  learnerId: string;
  requesterId: string;
  requesterRole: string;
  exportBeforeDelete: boolean;
  status: DeletionStatus;
  createdAt: string;
  updatedAt: string;
  retentionHold?: RetentionHold;
}

export interface DeletionWorkflowInput {
  learnerId: string;
  requesterId: string;
  requesterRole: string;
  exportBeforeDelete?: boolean;
  retentionHolds: RetentionHold[];
}

export function createDeletionRequest(input: DeletionWorkflowInput): DeletionRequest {
  const now = new Date().toISOString();
  const activeHold = input.retentionHolds.find((hold) => {
    if (!hold.expiresAt) return true;
    return new Date(hold.expiresAt).getTime() > Date.now();
  });
  const status: DeletionStatus = activeHold ? "BLOCKED_BY_RETENTION_HOLD" : "PENDING_REVIEW";
  return {
    id: randomUUID(),
    learnerId: input.learnerId,
    requesterId: input.requesterId,
    requesterRole: input.requesterRole,
    exportBeforeDelete: input.exportBeforeDelete ?? true,
    status,
    createdAt: now,
    updatedAt: now,
    retentionHold: activeHold,
  };
}

export function approveDeletion(request: DeletionRequest): DeletionRequest {
  if (request.status !== "PENDING_REVIEW") {
    throw new Error(`Cannot approve deletion in status ${request.status}`);
  }
  return { ...request, status: "SOFT_DELETED", updatedAt: new Date().toISOString() };
}

export function markReadyForHardDelete(request: DeletionRequest): DeletionRequest {
  if (request.status !== "SOFT_DELETED") {
    throw new Error(`Cannot mark hard-delete eligible from status ${request.status}`);
  }
  return {
    ...request,
    status: "READY_FOR_HARD_DELETE",
    updatedAt: new Date().toISOString(),
  };
}

export function finalizeHardDelete(request: DeletionRequest): DeletionRequest {
  if (request.status !== "READY_FOR_HARD_DELETE") {
    throw new Error(`Cannot hard-delete from status ${request.status}`);
  }
  return { ...request, status: "HARD_DELETED", updatedAt: new Date().toISOString() };
}
