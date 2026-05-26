import { randomUUID } from "node:crypto";
import { dpaAcceptances } from "@aivo/db";
import { desc, eq } from "drizzle-orm";
import {
  InMemoryEnrichedDpaStore,
  PostgresEnrichedDpaStore,
  type EnrichedDpaStore,
} from "./postgres-dpa-store.js";

export interface DpaAcceptanceInput {
  districtId: string;
  version: string;
  acceptedById: string;
  acceptedByName: string;
  acceptedByRole: string;
}

export interface DpaRecord extends DpaAcceptanceInput {
  id: string;
  acceptedAt: string;
}

/**
 * Common interface so the data-governance-svc routes don't need to
 * know whether they're talking to in-memory state (tests / local dev
 * without a database) or PostgreSQL (production). Same shape, same
 * return values.
 */
export interface DpaStore {
  acceptDpa(input: DpaAcceptanceInput): Promise<DpaRecord> | DpaRecord;
  latestForDistrict(districtId: string): Promise<DpaRecord | undefined> | DpaRecord | undefined;
  listForDistrict(districtId: string): Promise<DpaRecord[]> | DpaRecord[];
}

/**
 * In-memory implementation. Used by unit tests and local dev when no
 * DATABASE_URL is configured. Production MUST inject the Postgres
 * implementation below — `selectDpaStore()` enforces this.
 */
export class InMemoryDpaStore implements DpaStore {
  private records = new Map<string, DpaRecord[]>();

  acceptDpa(input: DpaAcceptanceInput): DpaRecord {
    const record: DpaRecord = {
      id: randomUUID(),
      acceptedAt: new Date().toISOString(),
      ...input,
    };
    const list = this.records.get(input.districtId) ?? [];
    list.push(record);
    this.records.set(input.districtId, list);
    return record;
  }

  latestForDistrict(districtId: string): DpaRecord | undefined {
    const list = this.records.get(districtId);
    if (!list || list.length === 0) return undefined;
    return list[list.length - 1];
  }

  listForDistrict(districtId: string): DpaRecord[] {
    return [...(this.records.get(districtId) ?? [])];
  }
}

function rowToRecord(row: typeof dpaAcceptances.$inferSelect): DpaRecord {
  return {
    id: row.id,
    districtId: row.districtId,
    version: row.version,
    acceptedById: row.acceptedById,
    acceptedByName: row.acceptedByName,
    acceptedByRole: row.acceptedByRole,
    acceptedAt: row.acceptedAt.toISOString(),
  };
}

/**
 * PostgreSQL-backed implementation. Writes to / reads from the shared
 * `dpa_acceptances` table declared in `@aivo/db`. Records survive
 * service restart, scale horizontally, and remain queryable for
 * compliance audits — the in-memory store provides none of those.
 */
export class PostgresDpaStore implements DpaStore {
  // `db` is a drizzle client (`createDb(DATABASE_URL)` from @aivo/db).
  // Typed as `any` to keep this file dependency-light; the real type
  // is exercised in integration tests.
  constructor(private readonly db: any) {}

  async acceptDpa(input: DpaAcceptanceInput): Promise<DpaRecord> {
    const [row] = await this.db
      .insert(dpaAcceptances)
      .values({
        districtId: input.districtId,
        version: input.version,
        acceptedById: input.acceptedById,
        acceptedByName: input.acceptedByName,
        acceptedByRole: input.acceptedByRole,
      })
      .returning();
    return rowToRecord(row);
  }

  async latestForDistrict(districtId: string): Promise<DpaRecord | undefined> {
    const rows = await this.db
      .select()
      .from(dpaAcceptances)
      .where(eq(dpaAcceptances.districtId, districtId))
      .orderBy(desc(dpaAcceptances.acceptedAt))
      .limit(1);
    return rows[0] ? rowToRecord(rows[0]) : undefined;
  }

  async listForDistrict(districtId: string): Promise<DpaRecord[]> {
    const rows = await this.db
      .select()
      .from(dpaAcceptances)
      .where(eq(dpaAcceptances.districtId, districtId))
      .orderBy(desc(dpaAcceptances.acceptedAt));
    return rows.map(rowToRecord);
  }
}

/**
 * Pick the right store at boot. Production requires `DATABASE_URL`
 * (and a drizzle client constructed from `@aivo/db.createDb`) so DPA
 * records are never lost on restart. Non-production tolerates the
 * in-memory store for dev / unit tests.
 *
 * Pass a constructed drizzle client to use Postgres; pass `null` to
 * force in-memory; pass `undefined` and the default behavior is
 * environment-aware (Postgres if `db` truthy, else in-memory).
 */
export function selectDpaStore(db: any | null | undefined): DpaStore {
  if (db) return new PostgresDpaStore(db);
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "data-governance-svc: DATABASE_URL / drizzle client required in production. " +
        "InMemoryDpaStore must NOT be used in production — DPA records would be " +
        "lost on restart, breaking compliance audits.",
    );
  }
  return new InMemoryDpaStore();
}

/**
 * Sprint 12.5 factory for the *enriched* DPA store (writes to the new
 * `dpa_acceptance_records` table that includes tenant_id, school_id,
 * signature_hash, addenda, etc.).
 *
 * Behaviour:
 *   - If a drizzle client is provided OR `DATABASE_URL` is set, returns
 *     the Postgres-backed store. The caller may pass `db` directly to
 *     avoid double-constructing the client.
 *   - If `NODE_ENV === "production"` and no drizzle client / DATABASE_URL
 *     is available, throws — DPA records must persist in production.
 *   - Otherwise (dev / test, no DB) returns the in-memory enriched store.
 *
 * The legacy `selectDpaStore` factory above remains for the older
 * district-only acceptance surface used by `/api/dpa/accept`.
 */
export function createDpaStore(db?: any | null): EnrichedDpaStore {
  if (db) return new PostgresEnrichedDpaStore(db);
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "data-governance-svc: DATABASE_URL / drizzle client required in production. " +
        "InMemoryEnrichedDpaStore must NOT be used in production — DPA records would " +
        "be lost on restart, breaking compliance audits.",
    );
  }
  return new InMemoryEnrichedDpaStore();
}

export type { EnrichedDpaStore } from "./postgres-dpa-store.js";
export {
  InMemoryEnrichedDpaStore,
  PostgresEnrichedDpaStore,
} from "./postgres-dpa-store.js";
