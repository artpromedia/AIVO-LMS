import "server-only";

import { adminGet, adminPatch, adminPost } from "./client";
import type { SessionProfile } from "@aivo/admin-auth/types";

/**
 * Admin surface for the support ticket queue.
 *
 * Backed by admin-svc, which persists to the Postgres `support_tickets` table
 * (@aivo/db). No mock store.
 *
 *   GET   /api/admin-svc/support/tickets
 *   POST  /api/admin-svc/support/tickets
 *   PATCH /api/admin-svc/support/tickets/:id
 */

export type SupportTicketStatus = "open" | "in_progress" | "resolved";

export const SUPPORT_TICKET_STATUSES: SupportTicketStatus[] = ["open", "in_progress", "resolved"];

export interface SupportTicket {
  id: string;
  tenantId: string | null;
  userId: string | null;
  subject: string;
  body: string;
  status: SupportTicketStatus;
  assigneeId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function normalizeStatus(value: unknown): SupportTicketStatus {
  const v = String(value ?? "open");
  return v === "in_progress" || v === "resolved" ? v : "open";
}

function mapTicket(row: Record<string, unknown>): SupportTicket {
  return {
    id: String(row.id),
    tenantId: row.tenantId ? String(row.tenantId) : null,
    userId: row.userId ? String(row.userId) : null,
    subject: String(row.subject ?? ""),
    body: String(row.body ?? ""),
    status: normalizeStatus(row.status),
    assigneeId: row.assigneeId ? String(row.assigneeId) : null,
    createdAt: row.createdAt ? String(row.createdAt) : null,
    updatedAt: row.updatedAt ? String(row.updatedAt) : null,
  };
}

export async function listSupportTickets(
  session: Pick<SessionProfile, "role">,
  status?: SupportTicketStatus,
): Promise<SupportTicket[]> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    "/api/admin-svc/support/tickets",
    status ? { status } : undefined,
  );
  const rows = Array.isArray(payload.tickets) ? payload.tickets : [];
  return rows.map((row) => mapTicket(row as Record<string, unknown>));
}

export async function createSupportTicket(
  session: Pick<SessionProfile, "role">,
  input: { subject: string; body?: string; tenantId?: string | null; userId?: string | null },
): Promise<SupportTicket> {
  const payload = await adminPost<Record<string, unknown>>(
    session,
    "/api/admin-svc/support/tickets",
    input,
  );
  return mapTicket((payload.ticket as Record<string, unknown>) ?? {});
}

export async function updateSupportTicket(
  session: Pick<SessionProfile, "role">,
  id: string,
  patch: { status?: SupportTicketStatus; assigneeId?: string | null },
): Promise<SupportTicket> {
  const payload = await adminPatch<Record<string, unknown>>(
    session,
    `/api/admin-svc/support/tickets/${encodeURIComponent(id)}`,
    patch,
  );
  return mapTicket((payload.ticket as Record<string, unknown>) ?? {});
}
