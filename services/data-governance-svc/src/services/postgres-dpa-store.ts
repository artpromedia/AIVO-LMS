/**
 * Sprint 12.5 Postgres-backed DPA store using the enriched
 * `dpa_acceptance_records` table.
 *
 * This is the production write/read path for new acceptance records.
 * The older `PostgresDpaStore` in `dpa-store.ts` continues to serve the
 * legacy `dpa_acceptances` table for back-compat reads — it is reused by
 * the existing `acceptDpa / latestForDistrict / listForDistrict`
 * surface. The richer surface here (with full audit context) is
 * exposed via the `EnrichedDpaStore` interface so future routes can
 * write tenant_id, signature_hash, ip_address, addenda etc.
 *
 * Construct via the `createDpaStore()` factory in `dpa-store.ts` —
 * that's where the production / non-production env guard lives.
 */
import { dpaAcceptanceRecords } from "@aivo/db";
import { and, desc, eq } from "drizzle-orm";

export interface EnrichedDpaAcceptanceInput {
  tenantId: string;
  schoolId?: string | null;
  districtId?: string | null;
  templateVersion: string;
  acceptedByUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  signatureHash: string;
  addenda?: string[];
  stateAddendumVersions?: Record<string, string>;
}

export interface EnrichedDpaRecord {
  id: string;
  tenantId: string;
  schoolId: string | null;
  districtId: string | null;
  templateVersion: string;
  acceptedByUserId: string;
  acceptedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  signatureHash: string;
  addenda: string[];
  stateAddendumVersions: Record<string, string>;
  createdAt: string;
}

export interface EnrichedDpaStore {
  recordAcceptance(input: EnrichedDpaAcceptanceInput): Promise<EnrichedDpaRecord>;
  latestForTenant(tenantId: string): Promise<EnrichedDpaRecord | undefined>;
  listForTenant(tenantId: string, limit?: number): Promise<EnrichedDpaRecord[]>;
  listForSchool(schoolId: string, limit?: number): Promise<EnrichedDpaRecord[]>;
  listForDistrict(districtId: string, limit?: number): Promise<EnrichedDpaRecord[]>;
}

function rowToRecord(row: typeof dpaAcceptanceRecords.$inferSelect): EnrichedDpaRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    schoolId: row.schoolId ?? null,
    districtId: row.districtId ?? null,
    templateVersion: row.templateVersion,
    acceptedByUserId: row.acceptedByUserId,
    acceptedAt: row.acceptedAt.toISOString(),
    ipAddress: row.ipAddress ?? null,
    userAgent: row.userAgent ?? null,
    signatureHash: row.signatureHash,
    addenda: (row.addenda as string[] | null) ?? [],
    stateAddendumVersions:
      (row.stateAddendumVersions as Record<string, string> | null) ?? {},
    createdAt: row.createdAt.toISOString(),
  };
}

export class PostgresEnrichedDpaStore implements EnrichedDpaStore {
  // `db` is a drizzle pg client (`createDb(DATABASE_URL)` from @aivo/db).
  // Typed as `any` to keep this file dependency-light; the real type is
  // exercised in integration tests.
  constructor(private readonly db: any) {}

  async recordAcceptance(input: EnrichedDpaAcceptanceInput): Promise<EnrichedDpaRecord> {
    const [row] = await this.db
      .insert(dpaAcceptanceRecords)
      .values({
        tenantId: input.tenantId,
        schoolId: input.schoolId ?? null,
        districtId: input.districtId ?? null,
        templateVersion: input.templateVersion,
        acceptedByUserId: input.acceptedByUserId,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        signatureHash: input.signatureHash,
        addenda: input.addenda ?? [],
        stateAddendumVersions: input.stateAddendumVersions ?? {},
      })
      .returning();
    return rowToRecord(row);
  }

  async latestForTenant(tenantId: string): Promise<EnrichedDpaRecord | undefined> {
    const rows = await this.db
      .select()
      .from(dpaAcceptanceRecords)
      .where(eq(dpaAcceptanceRecords.tenantId, tenantId))
      .orderBy(desc(dpaAcceptanceRecords.acceptedAt))
      .limit(1);
    return rows[0] ? rowToRecord(rows[0]) : undefined;
  }

  async listForTenant(tenantId: string, limit = 100): Promise<EnrichedDpaRecord[]> {
    const rows = await this.db
      .select()
      .from(dpaAcceptanceRecords)
      .where(eq(dpaAcceptanceRecords.tenantId, tenantId))
      .orderBy(desc(dpaAcceptanceRecords.acceptedAt))
      .limit(limit);
    return rows.map(rowToRecord);
  }

  async listForSchool(schoolId: string, limit = 100): Promise<EnrichedDpaRecord[]> {
    const rows = await this.db
      .select()
      .from(dpaAcceptanceRecords)
      .where(eq(dpaAcceptanceRecords.schoolId, schoolId))
      .orderBy(desc(dpaAcceptanceRecords.acceptedAt))
      .limit(limit);
    return rows.map(rowToRecord);
  }

  async listForDistrict(districtId: string, limit = 100): Promise<EnrichedDpaRecord[]> {
    const rows = await this.db
      .select()
      .from(dpaAcceptanceRecords)
      .where(eq(dpaAcceptanceRecords.districtId, districtId))
      .orderBy(desc(dpaAcceptanceRecords.acceptedAt))
      .limit(limit);
    return rows.map(rowToRecord);
  }
}

/**
 * In-memory fallback for the enriched surface. Test-only.
 * Production code paths must reject this — see `createDpaStore()`.
 */
export class InMemoryEnrichedDpaStore implements EnrichedDpaStore {
  private rows: EnrichedDpaRecord[] = [];

  async recordAcceptance(input: EnrichedDpaAcceptanceInput): Promise<EnrichedDpaRecord> {
    const now = new Date().toISOString();
    const rec: EnrichedDpaRecord = {
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      schoolId: input.schoolId ?? null,
      districtId: input.districtId ?? null,
      templateVersion: input.templateVersion,
      acceptedByUserId: input.acceptedByUserId,
      acceptedAt: now,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      signatureHash: input.signatureHash,
      addenda: input.addenda ?? [],
      stateAddendumVersions: input.stateAddendumVersions ?? {},
      createdAt: now,
    };
    this.rows.push(rec);
    return rec;
  }

  async latestForTenant(tenantId: string): Promise<EnrichedDpaRecord | undefined> {
    const matching = this.rows.filter((r) => r.tenantId === tenantId);
    if (matching.length === 0) return undefined;
    return matching[matching.length - 1];
  }

  async listForTenant(tenantId: string, limit = 100): Promise<EnrichedDpaRecord[]> {
    return this.rows
      .filter((r) => r.tenantId === tenantId)
      .slice()
      .reverse()
      .slice(0, limit);
  }

  async listForSchool(schoolId: string, limit = 100): Promise<EnrichedDpaRecord[]> {
    return this.rows
      .filter((r) => r.schoolId === schoolId)
      .slice()
      .reverse()
      .slice(0, limit);
  }

  async listForDistrict(districtId: string, limit = 100): Promise<EnrichedDpaRecord[]> {
    return this.rows
      .filter((r) => r.districtId === districtId)
      .slice()
      .reverse()
      .slice(0, limit);
  }
}

// Silences unused import in environments where drizzle's `and` helper
// isn't reached (kept for future combined predicates).
void and;
