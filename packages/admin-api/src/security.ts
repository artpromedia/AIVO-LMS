import "server-only";

import { adminGet, adminPatch, adminPost } from "./client";
import type { SessionProfile } from "@aivo/admin-auth/types";

/**
 * Admin surface for the security control register (SOC 2 / Trust Services).
 *
 * Backed by admin-svc, which persists to the Postgres `security_controls` /
 * `security_control_evidence` tables (@aivo/db). No mock store.
 *
 *   GET   /api/admin-svc/security/controls
 *   GET   /api/admin-svc/security/controls/:id
 *   POST  /api/admin-svc/security/controls
 *   PATCH /api/admin-svc/security/controls/:id
 */

export type SecurityCriterion =
  | "security"
  | "availability"
  | "processing_integrity"
  | "confidentiality"
  | "privacy";

export type SecurityControlStatus =
  | "implemented"
  | "partial"
  | "not_started"
  | "not_applicable";

export const SECURITY_CRITERIA: SecurityCriterion[] = [
  "security",
  "availability",
  "processing_integrity",
  "confidentiality",
  "privacy",
];

export const SECURITY_CONTROL_STATUSES: SecurityControlStatus[] = [
  "implemented",
  "partial",
  "not_started",
  "not_applicable",
];

export interface AdminSecurityControl {
  id: string;
  code: string;
  title: string;
  description: string;
  criterion: SecurityCriterion;
  owner: string;
  status: SecurityControlStatus;
  lastReviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminSecurityEvidence {
  id: string;
  controlId: string;
  kind: string;
  summary: string;
  uri: string | null;
  collectedByUserId: string | null;
  collectedAt: string | null;
}

function normalizeCriterion(value: unknown): SecurityCriterion {
  const v = String(value ?? "security");
  return (SECURITY_CRITERIA as string[]).includes(v) ? (v as SecurityCriterion) : "security";
}

function normalizeStatus(value: unknown): SecurityControlStatus {
  const v = String(value ?? "not_started");
  return (SECURITY_CONTROL_STATUSES as string[]).includes(v)
    ? (v as SecurityControlStatus)
    : "not_started";
}

function mapControl(row: Record<string, unknown>): AdminSecurityControl {
  return {
    id: String(row.id),
    code: String(row.code ?? ""),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    criterion: normalizeCriterion(row.criterion),
    owner: String(row.owner ?? ""),
    status: normalizeStatus(row.status),
    lastReviewedAt: row.lastReviewedAt ? String(row.lastReviewedAt) : null,
    createdAt: row.createdAt ? String(row.createdAt) : null,
    updatedAt: row.updatedAt ? String(row.updatedAt) : null,
  };
}

function mapEvidence(row: Record<string, unknown>): AdminSecurityEvidence {
  return {
    id: String(row.id),
    controlId: String(row.controlId ?? ""),
    kind: String(row.kind ?? "other"),
    summary: String(row.summary ?? ""),
    uri: row.uri ? String(row.uri) : null,
    collectedByUserId: row.collectedByUserId ? String(row.collectedByUserId) : null,
    collectedAt: row.collectedAt ? String(row.collectedAt) : null,
  };
}

export async function listSecurityControls(
  session: Pick<SessionProfile, "role">,
): Promise<AdminSecurityControl[]> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    "/api/admin-svc/security/controls",
  );
  const rows = Array.isArray(payload.controls) ? payload.controls : [];
  return rows.map((row) => mapControl(row as Record<string, unknown>));
}

export async function getSecurityControl(
  session: Pick<SessionProfile, "role">,
  id: string,
): Promise<{ control: AdminSecurityControl; evidence: AdminSecurityEvidence[] }> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    `/api/admin-svc/security/controls/${encodeURIComponent(id)}`,
  );
  const evidence = Array.isArray(payload.evidence) ? payload.evidence : [];
  return {
    control: mapControl((payload.control as Record<string, unknown>) ?? {}),
    evidence: evidence.map((row) => mapEvidence(row as Record<string, unknown>)),
  };
}

export async function createSecurityControl(
  session: Pick<SessionProfile, "role">,
  input: {
    code: string;
    title: string;
    description?: string;
    criterion: SecurityCriterion;
    owner?: string;
    status: SecurityControlStatus;
  },
): Promise<AdminSecurityControl> {
  const payload = await adminPost<Record<string, unknown>>(
    session,
    "/api/admin-svc/security/controls",
    input,
  );
  return mapControl((payload.control as Record<string, unknown>) ?? {});
}

export async function updateSecurityControl(
  session: Pick<SessionProfile, "role">,
  id: string,
  patch: {
    title?: string;
    description?: string;
    criterion?: SecurityCriterion;
    owner?: string;
    status?: SecurityControlStatus;
  },
): Promise<AdminSecurityControl> {
  const payload = await adminPatch<Record<string, unknown>>(
    session,
    `/api/admin-svc/security/controls/${encodeURIComponent(id)}`,
    patch,
  );
  return mapControl((payload.control as Record<string, unknown>) ?? {});
}

// ── Incidents ────────────────────────────────────────────────────────────────

export type IncidentSeverity = "sev1" | "sev2" | "sev3" | "sev4";
export type IncidentStatus =
  | "open"
  | "investigating"
  | "mitigating"
  | "resolved"
  | "post_mortem";

export const INCIDENT_SEVERITIES: IncidentSeverity[] = ["sev1", "sev2", "sev3", "sev4"];
export const INCIDENT_STATUSES: IncidentStatus[] = [
  "open",
  "investigating",
  "mitigating",
  "resolved",
  "post_mortem",
];

export interface AdminSecurityIncident {
  id: string;
  title: string;
  summary: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  commanderUserId: string | null;
  customerImpact: boolean;
  regulatorNotificationRequired: boolean;
  detectedAt: string | null;
  resolvedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function normalizeSeverity(value: unknown): IncidentSeverity {
  const v = String(value ?? "sev3");
  return (INCIDENT_SEVERITIES as string[]).includes(v) ? (v as IncidentSeverity) : "sev3";
}

function normalizeIncidentStatus(value: unknown): IncidentStatus {
  const v = String(value ?? "open");
  return (INCIDENT_STATUSES as string[]).includes(v) ? (v as IncidentStatus) : "open";
}

function mapIncident(row: Record<string, unknown>): AdminSecurityIncident {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    severity: normalizeSeverity(row.severity),
    status: normalizeIncidentStatus(row.status),
    commanderUserId: row.commanderUserId ? String(row.commanderUserId) : null,
    customerImpact: Boolean(row.customerImpact),
    regulatorNotificationRequired: Boolean(row.regulatorNotificationRequired),
    detectedAt: row.detectedAt ? String(row.detectedAt) : null,
    resolvedAt: row.resolvedAt ? String(row.resolvedAt) : null,
    createdAt: row.createdAt ? String(row.createdAt) : null,
    updatedAt: row.updatedAt ? String(row.updatedAt) : null,
  };
}

export async function listSecurityIncidents(
  session: Pick<SessionProfile, "role">,
): Promise<AdminSecurityIncident[]> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    "/api/admin-svc/security/incidents",
  );
  const rows = Array.isArray(payload.incidents) ? payload.incidents : [];
  return rows.map((row) => mapIncident(row as Record<string, unknown>));
}

export async function createSecurityIncident(
  session: Pick<SessionProfile, "role">,
  input: {
    title: string;
    summary?: string;
    severity: IncidentSeverity;
    status?: IncidentStatus;
    customerImpact?: boolean;
    regulatorNotificationRequired?: boolean;
  },
): Promise<AdminSecurityIncident> {
  const payload = await adminPost<Record<string, unknown>>(
    session,
    "/api/admin-svc/security/incidents",
    input,
  );
  return mapIncident((payload.incident as Record<string, unknown>) ?? {});
}

export async function updateSecurityIncident(
  session: Pick<SessionProfile, "role">,
  id: string,
  patch: {
    title?: string;
    summary?: string;
    severity?: IncidentSeverity;
    status?: IncidentStatus;
    customerImpact?: boolean;
    regulatorNotificationRequired?: boolean;
  },
): Promise<AdminSecurityIncident> {
  const payload = await adminPatch<Record<string, unknown>>(
    session,
    `/api/admin-svc/security/incidents/${encodeURIComponent(id)}`,
    patch,
  );
  return mapIncident((payload.incident as Record<string, unknown>) ?? {});
}
