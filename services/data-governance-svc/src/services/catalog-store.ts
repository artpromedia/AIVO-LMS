/**
 * Data-class catalog + retention-policy store (Sprint 5).
 *
 * The catalog is seeded configuration: every data class the platform
 * holds, its owning service, sensitivity tier, and default retention.
 * Retention policies are editable overrides per data class (platform
 * default, optionally tenant-scoped). In-memory; the Postgres
 * `data_catalog` / `retention_policies` tables back it in production.
 */
import { retentionPolicies } from "@aivo/db";
import { and, eq, isNull } from "drizzle-orm";
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

export interface SetRetentionPolicyInput {
  dataClass: string;
  tenantId?: string | null;
  retentionDays: number | null;
  disposition: Disposition;
  legalHold?: boolean;
  updatedById?: string | null;
}

/** Catalog default for a class when no override row exists. */
function defaultPolicy(dataClass: string, tenantId: string | null): StoredPolicy {
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

/**
 * Store for retention-policy overrides only. The data-class catalog itself is
 * static config (see `listCatalog` / `getDataClass`) and is NOT backed by this
 * store. Methods may return a value or a Promise (DB-or-fallback pattern,
 * mirroring `dpa-store.ts`).
 */
export interface RetentionPolicyStore {
  /** Read an override row (dataClass + tenantId, falling back to tenantId=null);
   *  undefined when none exists. */
  getOverride(
    dataClass: string,
    tenantId: string | null,
  ): Promise<StoredPolicy | undefined> | StoredPolicy | undefined;
  /** Upsert an override row (unique on dataClass + tenantId). */
  upsert(input: SetRetentionPolicyInput): Promise<StoredPolicy> | StoredPolicy;
  clear(): void;
}

export class InMemoryRetentionPolicyStore implements RetentionPolicyStore {
  private policies = new Map<string, StoredPolicy>();

  private key(dataClass: string, tenantId: string | null): string {
    return `${dataClass}::${tenantId ?? "*"}`;
  }

  getOverride(dataClass: string, tenantId: string | null): StoredPolicy | undefined {
    return (
      this.policies.get(this.key(dataClass, tenantId)) ??
      this.policies.get(this.key(dataClass, null))
    );
  }

  upsert(input: SetRetentionPolicyInput): StoredPolicy {
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
    this.policies.set(this.key(input.dataClass, tenantId), rec);
    return rec;
  }

  clear(): void {
    this.policies.clear();
  }
}

function rowToStoredPolicy(row: typeof retentionPolicies.$inferSelect): StoredPolicy {
  return {
    dataClass: row.dataClass,
    tenantId: row.tenantId,
    retentionDays: row.retentionDays,
    disposition: row.disposition as Disposition,
    legalHold: row.legalHold,
    updatedById: row.updatedById,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PostgresRetentionPolicyStore implements RetentionPolicyStore {
  // `db` is a drizzle client; typed `any` to keep this file dependency-light.
  constructor(private readonly db: any) {}

  private async readRow(
    dataClass: string,
    tenantId: string | null,
  ): Promise<StoredPolicy | undefined> {
    const rows = await this.db
      .select()
      .from(retentionPolicies)
      .where(
        and(
          eq(retentionPolicies.dataClass, dataClass),
          tenantId === null
            ? isNull(retentionPolicies.tenantId)
            : eq(retentionPolicies.tenantId, tenantId),
        ),
      )
      .limit(1);
    return rows[0] ? rowToStoredPolicy(rows[0]) : undefined;
  }

  async getOverride(
    dataClass: string,
    tenantId: string | null,
  ): Promise<StoredPolicy | undefined> {
    const scoped = tenantId !== null ? await this.readRow(dataClass, tenantId) : undefined;
    if (scoped) return scoped;
    return this.readRow(dataClass, null);
  }

  async upsert(input: SetRetentionPolicyInput): Promise<StoredPolicy> {
    const tenantId = input.tenantId ?? null;
    const values = {
      tenantId,
      dataClass: input.dataClass,
      retentionDays: input.retentionDays,
      disposition: input.disposition,
      legalHold: input.legalHold ?? false,
      updatedById: input.updatedById ?? null,
      updatedAt: new Date(),
    };
    const [row] = await this.db
      .insert(retentionPolicies)
      .values(values)
      .onConflictDoUpdate({
        target: [retentionPolicies.dataClass, retentionPolicies.tenantId],
        set: {
          retentionDays: values.retentionDays,
          disposition: values.disposition,
          legalHold: values.legalHold,
          updatedById: values.updatedById,
          updatedAt: values.updatedAt,
        },
      })
      .returning();
    return rowToStoredPolicy(row);
  }

  clear(): void {
    // No-op: production state is not cleared from process memory.
  }
}

/**
 * Pick the right retention-policy store at boot. Production requires a drizzle
 * client; non-production tolerates the in-memory store.
 */
export function selectRetentionPolicyStore(db: any | null | undefined): RetentionPolicyStore {
  if (db) return new PostgresRetentionPolicyStore(db);
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "data-governance-svc: DATABASE_URL / drizzle client required in production. " +
        "InMemoryRetentionPolicyStore must NOT be used in production — retention " +
        "policy overrides would be lost on restart.",
    );
  }
  return new InMemoryRetentionPolicyStore();
}

let POLICY_STORE: RetentionPolicyStore = new InMemoryRetentionPolicyStore();

/** Initialize the retention-policy store from a (possibly absent) drizzle
 *  client. In production with no client, throws. */
export function initCatalogStoreFromDb(db: any | null | undefined): void {
  POLICY_STORE = selectRetentionPolicyStore(db);
}

export function clearCatalogStoreForTest(): void {
  if (POLICY_STORE instanceof InMemoryRetentionPolicyStore) {
    POLICY_STORE.clear();
  } else {
    POLICY_STORE = new InMemoryRetentionPolicyStore();
  }
}

/** Effective policy for a class: explicit override → catalog default. */
export async function getRetentionPolicy(
  dataClass: string,
  tenantId: string | null = null,
): Promise<StoredPolicy> {
  const override = await POLICY_STORE.getOverride(dataClass, tenantId);
  if (override) return override;
  return defaultPolicy(dataClass, tenantId);
}

export async function listRetentionPolicies(
  tenantId: string | null = null,
): Promise<StoredPolicy[]> {
  return Promise.all(listCatalog().map((c) => getRetentionPolicy(c.dataClass, tenantId)));
}

export async function setRetentionPolicy(
  input: SetRetentionPolicyInput,
): Promise<StoredPolicy> {
  return POLICY_STORE.upsert(input);
}
