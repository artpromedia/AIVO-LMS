/**
 * Append-with-hash-chain helper for audit tables (Sprint 4).
 *
 * `appendAudit(db, table, row, options)` reads the latest row's `hash`
 * (ordered by `seq`), computes the new row's `prevHash`/`hash`, and inserts
 * inside a transaction so two concurrent inserts cannot race to compute the
 * same `prevHash`. The append-only triggers in the migration enforce that
 * once written, rows cannot be modified or deleted.
 */
import { sql } from "drizzle-orm";
import { computeAuditHash } from "@aivo/security";

export interface AppendAuditOptions {
  /**
   * Field names included in the chain hash. Defaults to every key in `row`.
   * Order is irrelevant — `computeAuditHash` canonicalizes the payload.
   */
  payloadKeys?: readonly string[];
}

/**
 * Insert one row into an audit table while maintaining the hash chain.
 *
 * `table` must be a drizzle table that has `seq`, `prevHash`, `hash`
 * columns and a SQL identifier we can interpolate. Pass the SQL table name
 * explicitly to avoid leaking drizzle internals.
 */
export async function appendAudit<TRow extends Record<string, any>>(
  db: any,
  tableName: string,
  table: any,
  row: TRow,
  options: AppendAuditOptions = {},
): Promise<TRow & { hash: string; prevHash: string }> {
  const payloadKeys = options.payloadKeys ?? Object.keys(row);

  // Serialize through a transaction-scoped Postgres advisory lock keyed on
  // the table name so the (read-latest, compute, insert) window cannot
  // interleave with another inserter on the same chain. The lock is
  // released automatically at COMMIT.
  return await db.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${tableName}))`);
    const latest = await tx.execute(
      sql`SELECT hash FROM ${sql.identifier(tableName)} ORDER BY seq DESC LIMIT 1`,
    );
    const prevHash: string =
      (Array.isArray(latest) ? latest[0]?.hash : latest?.rows?.[0]?.hash) ?? "";
    const payload: Record<string, any> = {};
    for (const k of payloadKeys) payload[k] = row[k];
    const hash = computeAuditHash(prevHash, payload);
    const [inserted] = await tx
      .insert(table)
      .values({ ...row, prevHash, hash })
      .returning();
    return inserted as TRow & { hash: string; prevHash: string };
  });
}
