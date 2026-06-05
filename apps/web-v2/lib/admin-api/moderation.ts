import "server-only";

import { adminGet, adminPatch } from "./client";
import type { SessionProfile } from "@/lib/auth/types";

export type AdminModerationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "ESCALATED"
  | "LOW_CONFIDENCE";

export interface AdminModerationEvent {
  id: string;
  tenantId: string | null;
  learnerId: string | null;
  sessionId: string | null;
  contentType: string;
  content: string;
  flagReason: string;
  flagConfidence: number | null;
  tutorSku: string | null;
  modelUsed: string | null;
  status: AdminModerationStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
}

export interface AdminModerationStats {
  byStatus: { status: string; count: number }[];
  byReason: { reason: string; count: number }[];
  byTutor: { tutor: string; count: number }[];
}

type ModerationListOptions = {
  status?: AdminModerationStatus;
  page?: number;
  perPage?: number;
};

function normalizeStatus(value: unknown): AdminModerationStatus {
  const status = String(value ?? "PENDING").toUpperCase();
  if (
    status === "APPROVED" ||
    status === "REJECTED" ||
    status === "ESCALATED" ||
    status === "LOW_CONFIDENCE"
  ) {
    return status;
  }
  return "PENDING";
}

function mapModerationEvent(row: Record<string, unknown>): AdminModerationEvent {
  return {
    id: String(row.id),
    tenantId: row.tenantId ? String(row.tenantId) : null,
    learnerId: row.learnerId ? String(row.learnerId) : null,
    sessionId: row.sessionId ? String(row.sessionId) : null,
    contentType: String(row.contentType ?? "unknown"),
    content: String(row.content ?? ""),
    flagReason: String(row.flagReason ?? "unknown"),
    flagConfidence:
      row.flagConfidence === null || row.flagConfidence === undefined
        ? null
        : Number(row.flagConfidence),
    tutorSku: row.tutorSku ? String(row.tutorSku) : null,
    modelUsed: row.modelUsed ? String(row.modelUsed) : null,
    status: normalizeStatus(row.status),
    reviewedBy: row.reviewedBy ? String(row.reviewedBy) : null,
    reviewedAt: row.reviewedAt ? String(row.reviewedAt) : null,
    reviewNotes: row.reviewNotes ? String(row.reviewNotes) : null,
    createdAt: String(row.createdAt ?? new Date(0).toISOString()),
  };
}

export async function listModerationEvents(
  session: Pick<SessionProfile, "role">,
  options: ModerationListOptions = {},
): Promise<AdminModerationEvent[]> {
  const payload = await adminGet<Record<string, unknown>>(session, "/api/admin-svc/moderation", {
    page: options.page ?? 1,
    perPage: options.perPage ?? 200,
    status: options.status,
  });
  const items = Array.isArray(payload.items) ? payload.items : [];
  return items.map((item) => mapModerationEvent(item as Record<string, unknown>));
}

export async function getModerationStats(
  session: Pick<SessionProfile, "role">,
): Promise<AdminModerationStats> {
  const payload = await adminGet<Record<string, unknown>>(session, "/api/admin-svc/moderation/stats");
  const byStatus = Array.isArray(payload.byStatus) ? payload.byStatus : [];
  const byReason = Array.isArray(payload.byReason) ? payload.byReason : [];
  const byTutor = Array.isArray(payload.byTutor) ? payload.byTutor : [];
  return {
    byStatus: byStatus.map((row) => ({
      status: String((row as Record<string, unknown>).status ?? "unknown"),
      count: Number((row as Record<string, unknown>).count ?? 0),
    })),
    byReason: byReason.map((row) => ({
      reason: String((row as Record<string, unknown>).reason ?? "unknown"),
      count: Number((row as Record<string, unknown>).count ?? 0),
    })),
    byTutor: byTutor.map((row) => ({
      tutor: String((row as Record<string, unknown>).tutor ?? "unknown"),
      count: Number((row as Record<string, unknown>).count ?? 0),
    })),
  };
}

export async function updateModerationEventStatus(
  session: Pick<SessionProfile, "role">,
  eventId: string,
  status: AdminModerationStatus,
  reviewNotes?: string | null,
): Promise<AdminModerationEvent> {
  const payload = await adminPatch<Record<string, unknown>>(
    session,
    `/api/admin-svc/moderation/${encodeURIComponent(eventId)}`,
    { status, reviewNotes: reviewNotes ?? null },
  );
  return mapModerationEvent(payload);
}
