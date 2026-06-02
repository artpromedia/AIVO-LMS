/**
 * Data-class catalog + retention-policy store (Sprint 5).
 *
 * The catalog is seeded configuration: every data class the platform
 * holds, its owning service, sensitivity tier, and default retention.
 * Retention policies are editable overrides per data class (platform
 * default, optionally tenant-scoped). In-memory; the Postgres
 * `data_catalog` / `retention_policies` tables back it in production.
 */
import type { Disposition, RetentionPolicy } from "../domain/retention-preview.js";

export type Sensitivity = "low" | "moderate" | "high" | "restricted";

export interface DataClass {
  dataClass: string;
  owningService: string;
  sensitivity: Sensitivity;
  description: string;
  defaultRetentionDays: number | null;
  erasable: boolean;
}

/** Seed catalog — the canonical set of data classes across services. */
export const DATA_CATALOG: DataClass[] = [
  {
    dataClass: "identity_profile",
    owningService: "identity-svc",
    sensitivity: "restricted",
    description: "Learner/user name, email, DOB, login identifiers.",
    defaultRetentionDays: null,
    erasable: true,
  },
  {
    dataClass: "auth_sessions",
    owningService: "identity-svc",
    sensitivity: "high",
    description: "Session tokens and login history.",
    defaultRetentionDays: 90,
    erasable: true,
  },
  {
    dataClass: "tenant_membership",
    owningService: "tenant-svc",
    sensitivity: "moderate",
    description: "School/district enrollment and role assignments.",
    defaultRetentionDays: null,
    erasable: true,
  },
  {
    dataClass: "billing_records",
    owningService: "billing-svc",
    sensitivity: "high",
    description: "Invoices, subscriptions, payment metadata.",
    defaultRetentionDays: 2555,
    erasable: false,
  },
  {
    dataClass: "assessment_scores",
    owningService: "learning-svc",
    sensitivity: "restricted",
    description: "FERPA education records — baseline + assessment results.",
    defaultRetentionDays: 1825,
    erasable: true,
  },
  {
    dataClass: "lesson_activity",
    owningService: "learning-svc",
    sensitivity: "high",
    description: "Lesson runs, mastery, engagement telemetry.",
    defaultRetentionDays: 1095,
    erasable: true,
  },
  {
    dataClass: "chat_logs",
    owningService: "learning-svc",
    sensitivity: "high",
    description: "Tutor/homework conversation transcripts.",
    defaultRetentionDays: 365,
    erasable: true,
  },
  {
    dataClass: "integration_rostering",
    owningService: "integration-svc",
    sensitivity: "moderate",
    description: "SIS/LMS roster sync records and external IDs.",
    defaultRetentionDays: 365,
    erasable: true,
  },
  {
    dataClass: "admin_actions",
    owningService: "admin-svc",
    sensitivity: "moderate",
    description: "Admin console operations attributable to a subject.",
    defaultRetentionDays: 1095,
    erasable: true,
  },
  {
    dataClass: "audit_events",
    owningService: "audit-svc",
    sensitivity: "high",
    description: "Hash-chained audit trail; actor info anonymized, chain preserved.",
    defaultRetentionDays: 2555,
    erasable: false,
  },
];

export function listCatalog(): DataClass[] {
  return [...DATA_CATALOG].sort((a, b) => a.dataClass.localeCompare(b.dataClass));
}

export function getDataClass(dataClass: string): DataClass | undefined {
  return DATA_CATALOG.find((c) => c.dataClass === dataClass);
}

// ── Retention policies ───────────────────────────────────────────────────────

interface StoredPolicy extends RetentionPolicy {
  tenantId: string | null;
  updatedById: string | null;
  updatedAt: string;
}

const policyKey = (dataClass: string, tenantId: string | null) =>
  `${dataClass}::${tenantId ?? "*"}`;
const policies = new Map<string, StoredPolicy>();

export function clearCatalogStoreForTest(): void {
  policies.clear();
}

/** Effective policy for a class: explicit override → catalog default. */
export function getRetentionPolicy(
  dataClass: string,
  tenantId: string | null = null,
): StoredPolicy {
  const override =
    policies.get(policyKey(dataClass, tenantId)) ?? policies.get(policyKey(dataClass, null));
  if (override) return override;
  const cat = getDataClass(dataClass);
  return {
    dataClass,
    tenantId,
    retentionDays: cat?.defaultRetentionDays ?? null,
    disposition: cat?.dataClass === "audit_events" ? "anonymize" : "purge",
    legalHold: false,
    updatedById: null,
    updatedAt: new Date(0).toISOString(),
  };
}

export function listRetentionPolicies(tenantId: string | null = null): StoredPolicy[] {
  return listCatalog().map((c) => getRetentionPolicy(c.dataClass, tenantId));
}

export function setRetentionPolicy(input: {
  dataClass: string;
  tenantId?: string | null;
  retentionDays: number | null;
  disposition: Disposition;
  legalHold?: boolean;
  updatedById?: string | null;
}): StoredPolicy {
  const tenantId = input.tenantId ?? null;
  const rec: StoredPolicy = {
    dataClass: input.dataClass,
    tenantId,
    retentionDays: input.retentionDays,
    disposition: input.disposition,
    legalHold: input.legalHold ?? false,
    updatedById: input.updatedById ?? null,
    updatedAt: new Date().toISOString(),
  };
  policies.set(policyKey(input.dataClass, tenantId), rec);
  return rec;
}
