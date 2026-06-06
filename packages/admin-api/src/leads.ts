import "server-only";

import { adminGet, adminPatch } from "./client";
import type { SessionProfile } from "@aivo/admin-auth/types";

/** Lead lifecycle (mirrors admin-svc). */
export const LEAD_STATUSES = ["new", "contacted", "qualified", "pilot", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Allowed forward transitions; won/lost are terminal. */
export const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ["contacted", "lost"],
  contacted: ["qualified", "lost"],
  qualified: ["pilot", "won", "lost"],
  pilot: ["won", "lost"],
  won: [],
  lost: [],
};

/** The statuses an operator may move a lead to from its current one. */
export function nextLeadStatuses(current: string): LeadStatus[] {
  return LEAD_TRANSITIONS[current as LeadStatus] ?? [];
}

export type AdminLead = {
  id: string;
  type: string;
  name: string;
  email: string;
  company: string | null;
  role: string | null;
  message: string | null;
  schoolSize: string | null;
  gradeBand: string | null;
  interestArea: string | null;
  source: string;
  status: LeadStatus;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  couponCode: string | null;
  createdAt: string;
  updatedAt: string | null;
};

function s(value: unknown): string | null {
  return value == null ? null : String(value);
}

function mapLead(row: Record<string, unknown>): AdminLead {
  const status = String(row.status ?? "new");
  return {
    id: String(row.id),
    type: String(row.type),
    name: String(row.name),
    email: String(row.email),
    company: s(row.company),
    role: s(row.role),
    message: s(row.message),
    schoolSize: s(row.schoolSize),
    gradeBand: s(row.gradeBand),
    interestArea: s(row.interestArea),
    source: String(row.source ?? "website"),
    status: ((LEAD_STATUSES as readonly string[]).includes(status) ? status : "new") as LeadStatus,
    utmSource: s(row.utmSource),
    utmMedium: s(row.utmMedium),
    utmCampaign: s(row.utmCampaign),
    couponCode: s(row.couponCode),
    createdAt: String(row.createdAt ?? new Date(0).toISOString()),
    updatedAt: s(row.updatedAt),
  };
}

/** List leads (newest first), optionally filtered by lifecycle status. */
export async function listLeads(
  session: Pick<SessionProfile, "role">,
  opts?: { status?: LeadStatus },
): Promise<AdminLead[]> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    "/api/admin-svc/leads",
    opts?.status ? { status: opts.status } : undefined,
  );
  const rows = Array.isArray(payload.leads) ? payload.leads : [];
  return rows.map((r) => mapLead(r as Record<string, unknown>));
}

/** Fetch a single lead, or null if it doesn't exist. */
export async function getLead(
  session: Pick<SessionProfile, "role">,
  id: string,
): Promise<AdminLead | null> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    `/api/admin-svc/leads/${encodeURIComponent(id)}`,
  );
  const row = payload.lead;
  return row && typeof row === "object" ? mapLead(row as Record<string, unknown>) : null;
}

/** Move a lead to a new lifecycle status (admin-svc validates the transition). */
export async function updateLeadStatus(
  session: Pick<SessionProfile, "role">,
  id: string,
  status: LeadStatus,
): Promise<{ id: string; status: string }> {
  const res = await adminPatch<{ id?: string; status?: string }>(
    session,
    `/api/admin-svc/leads/${encodeURIComponent(id)}/status`,
    { status },
  );
  return { id: String(res.id ?? id), status: String(res.status ?? status) };
}
