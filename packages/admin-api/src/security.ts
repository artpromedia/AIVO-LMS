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

// ── Risks ────────────────────────────────────────────────────────────────────

export type RiskCategory = "security" | "privacy" | "availability" | "operational" | "third_party";
export type RiskSeverity = "low" | "medium" | "high" | "critical";
export type RiskTreatment = "accept" | "mitigate" | "transfer" | "avoid";

export const RISK_CATEGORIES: RiskCategory[] = [
  "security",
  "privacy",
  "availability",
  "operational",
  "third_party",
];
export const RISK_SEVERITIES: RiskSeverity[] = ["low", "medium", "high", "critical"];
export const RISK_TREATMENTS: RiskTreatment[] = ["accept", "mitigate", "transfer", "avoid"];

export interface AdminSecurityRisk {
  id: string;
  title: string;
  description: string;
  category: RiskCategory;
  inherentSeverity: RiskSeverity;
  residualSeverity: RiskSeverity;
  treatment: RiskTreatment;
  owner: string;
  open: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const v = String(value ?? "");
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function mapRisk(row: Record<string, unknown>): AdminSecurityRisk {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    category: oneOf(row.category, RISK_CATEGORIES, "security"),
    inherentSeverity: oneOf(row.inherentSeverity, RISK_SEVERITIES, "medium"),
    residualSeverity: oneOf(row.residualSeverity, RISK_SEVERITIES, "medium"),
    treatment: oneOf(row.treatment, RISK_TREATMENTS, "mitigate"),
    owner: String(row.owner ?? ""),
    open: Boolean(row.open),
    createdAt: row.createdAt ? String(row.createdAt) : null,
    updatedAt: row.updatedAt ? String(row.updatedAt) : null,
  };
}

export async function listSecurityRisks(
  session: Pick<SessionProfile, "role">,
): Promise<AdminSecurityRisk[]> {
  const payload = await adminGet<Record<string, unknown>>(session, "/api/admin-svc/security/risks");
  const rows = Array.isArray(payload.risks) ? payload.risks : [];
  return rows.map((row) => mapRisk(row as Record<string, unknown>));
}

export async function createSecurityRisk(
  session: Pick<SessionProfile, "role">,
  input: {
    title: string;
    description?: string;
    category: RiskCategory;
    inherentSeverity: RiskSeverity;
    residualSeverity: RiskSeverity;
    treatment: RiskTreatment;
    owner?: string;
  },
): Promise<AdminSecurityRisk> {
  const payload = await adminPost<Record<string, unknown>>(
    session,
    "/api/admin-svc/security/risks",
    input,
  );
  return mapRisk((payload.risk as Record<string, unknown>) ?? {});
}

export async function updateSecurityRisk(
  session: Pick<SessionProfile, "role">,
  id: string,
  patch: {
    title?: string;
    description?: string;
    category?: RiskCategory;
    inherentSeverity?: RiskSeverity;
    residualSeverity?: RiskSeverity;
    treatment?: RiskTreatment;
    owner?: string;
    open?: boolean;
  },
): Promise<AdminSecurityRisk> {
  const payload = await adminPatch<Record<string, unknown>>(
    session,
    `/api/admin-svc/security/risks/${encodeURIComponent(id)}`,
    patch,
  );
  return mapRisk((payload.risk as Record<string, unknown>) ?? {});
}

// ── Vendors ──────────────────────────────────────────────────────────────────

export type VendorCategory =
  | "llm_provider"
  | "tts_provider"
  | "infra"
  | "analytics"
  | "support"
  | "billing"
  | "other";
export type VendorRiskTier = "tier1" | "tier2" | "tier3";

export const VENDOR_CATEGORIES: VendorCategory[] = [
  "llm_provider",
  "tts_provider",
  "infra",
  "analytics",
  "support",
  "billing",
  "other",
];
export const VENDOR_RISK_TIERS: VendorRiskTier[] = ["tier1", "tier2", "tier3"];

export interface AdminSecurityVendor {
  id: string;
  name: string;
  category: VendorCategory;
  dataResidency: string;
  processesLearnerData: boolean;
  dpaSigned: boolean;
  riskTier: VendorRiskTier;
  approved: boolean;
  notes: string | null;
  lastReviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function mapVendor(row: Record<string, unknown>): AdminSecurityVendor {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    category: oneOf(row.category, VENDOR_CATEGORIES, "other"),
    dataResidency: String(row.dataResidency ?? ""),
    processesLearnerData: Boolean(row.processesLearnerData),
    dpaSigned: Boolean(row.dpaSigned),
    riskTier: oneOf(row.riskTier, VENDOR_RISK_TIERS, "tier3"),
    approved: Boolean(row.approved),
    notes: row.notes ? String(row.notes) : null,
    lastReviewedAt: row.lastReviewedAt ? String(row.lastReviewedAt) : null,
    createdAt: row.createdAt ? String(row.createdAt) : null,
    updatedAt: row.updatedAt ? String(row.updatedAt) : null,
  };
}

export async function listSecurityVendors(
  session: Pick<SessionProfile, "role">,
): Promise<AdminSecurityVendor[]> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    "/api/admin-svc/security/vendors",
  );
  const rows = Array.isArray(payload.vendors) ? payload.vendors : [];
  return rows.map((row) => mapVendor(row as Record<string, unknown>));
}

export async function createSecurityVendor(
  session: Pick<SessionProfile, "role">,
  input: {
    name: string;
    category: VendorCategory;
    dataResidency?: string;
    processesLearnerData?: boolean;
    dpaSigned?: boolean;
    riskTier: VendorRiskTier;
    approved?: boolean;
    notes?: string | null;
  },
): Promise<AdminSecurityVendor> {
  const payload = await adminPost<Record<string, unknown>>(
    session,
    "/api/admin-svc/security/vendors",
    input,
  );
  return mapVendor((payload.vendor as Record<string, unknown>) ?? {});
}

export async function updateSecurityVendor(
  session: Pick<SessionProfile, "role">,
  id: string,
  patch: {
    name?: string;
    category?: VendorCategory;
    dataResidency?: string;
    processesLearnerData?: boolean;
    dpaSigned?: boolean;
    riskTier?: VendorRiskTier;
    approved?: boolean;
    notes?: string | null;
  },
): Promise<AdminSecurityVendor> {
  const payload = await adminPatch<Record<string, unknown>>(
    session,
    `/api/admin-svc/security/vendors/${encodeURIComponent(id)}`,
    patch,
  );
  return mapVendor((payload.vendor as Record<string, unknown>) ?? {});
}

// ── Vulnerabilities ──────────────────────────────────────────────────────────

export type VulnSeverity = "low" | "medium" | "high" | "critical";
export type VulnStatus = "open" | "triaged" | "fixed" | "wontfix";
export type VulnSource =
  | "dependency_scan"
  | "container_scan"
  | "iac_scan"
  | "pen_test"
  | "external_report"
  | "internal";

export const VULN_SEVERITIES: VulnSeverity[] = ["low", "medium", "high", "critical"];
export const VULN_STATUSES: VulnStatus[] = ["open", "triaged", "fixed", "wontfix"];
export const VULN_SOURCES: VulnSource[] = [
  "dependency_scan",
  "container_scan",
  "iac_scan",
  "pen_test",
  "external_report",
  "internal",
];

export interface AdminSecurityVulnerability {
  id: string;
  title: string;
  cveId: string | null;
  severity: VulnSeverity;
  status: VulnStatus;
  source: VulnSource;
  affectedComponent: string;
  fixedIn: string | null;
  discoveredAt: string | null;
  resolvedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function mapVuln(row: Record<string, unknown>): AdminSecurityVulnerability {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    cveId: row.cveId ? String(row.cveId) : null,
    severity: oneOf(row.severity, VULN_SEVERITIES, "medium"),
    status: oneOf(row.status, VULN_STATUSES, "open"),
    source: oneOf(row.source, VULN_SOURCES, "internal"),
    affectedComponent: String(row.affectedComponent ?? ""),
    fixedIn: row.fixedIn ? String(row.fixedIn) : null,
    discoveredAt: row.discoveredAt ? String(row.discoveredAt) : null,
    resolvedAt: row.resolvedAt ? String(row.resolvedAt) : null,
    createdAt: row.createdAt ? String(row.createdAt) : null,
    updatedAt: row.updatedAt ? String(row.updatedAt) : null,
  };
}

export async function listSecurityVulnerabilities(
  session: Pick<SessionProfile, "role">,
): Promise<AdminSecurityVulnerability[]> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    "/api/admin-svc/security/vulnerabilities",
  );
  const rows = Array.isArray(payload.vulnerabilities) ? payload.vulnerabilities : [];
  return rows.map((row) => mapVuln(row as Record<string, unknown>));
}

export async function createSecurityVulnerability(
  session: Pick<SessionProfile, "role">,
  input: {
    title: string;
    cveId?: string | null;
    severity: VulnSeverity;
    status?: VulnStatus;
    source: VulnSource;
    affectedComponent?: string;
    fixedIn?: string | null;
  },
): Promise<AdminSecurityVulnerability> {
  const payload = await adminPost<Record<string, unknown>>(
    session,
    "/api/admin-svc/security/vulnerabilities",
    input,
  );
  return mapVuln((payload.vulnerability as Record<string, unknown>) ?? {});
}

export async function updateSecurityVulnerability(
  session: Pick<SessionProfile, "role">,
  id: string,
  patch: {
    title?: string;
    cveId?: string | null;
    severity?: VulnSeverity;
    status?: VulnStatus;
    source?: VulnSource;
    affectedComponent?: string;
    fixedIn?: string | null;
  },
): Promise<AdminSecurityVulnerability> {
  const payload = await adminPatch<Record<string, unknown>>(
    session,
    `/api/admin-svc/security/vulnerabilities/${encodeURIComponent(id)}`,
    patch,
  );
  return mapVuln((payload.vulnerability as Record<string, unknown>) ?? {});
}
