/**
 * Hash-chain verification over a row range (Sprint B4).
 *
 * Counterpart to `appendAudit`: walks rows in `seq` order, recomputes each
 * row's `hash = sha256(prevHash || canonical(payload))`, and reports the
 * first divergence. Works over a date-bounded slice so a district can
 * verify "last quarter" without the server re-reading the whole table.
 *
 * `canonicalize` (in @aivo/security) drops `undefined` keys but keeps
 * explicit `null`s, so the recomputed payload must use the SAME key set the
 * writer passed to `appendAudit`. Writers are standardized per table (and
 * gated by scripts/audit-trail-audit.mjs); a small set of recorded legacy
 * profiles keeps rows written before standardization verifiable. A row
 * matching ANY profile is intact — the chain linkage (`prevHash` === the
 * previous row's stored `hash`) is checked independently of profiles.
 */
import { sql } from "drizzle-orm";
import { computeAuditHash } from "@aivo/security";

/** Canonical + legacy writer key profiles per audit table. */
export const AUDIT_CHAIN_PROFILES: Record<string, readonly (readonly string[])[]> = {
  district_activity_log: [
    [
      "tenantId",
      "action",
      "actorId",
      "actorName",
      "onBehalfOfId",
      "resourceType",
      "resourceId",
      "details",
    ],
  ],
  admin_audit_log: [
    // Canonical writer profile (every key, nulls explicit).
    [
      "action",
      "actorId",
      "actorEmail",
      "actorRole",
      "onBehalfOfId",
      "resourceType",
      "resourceId",
      "details",
      "ipAddress",
      "userAgent",
      "tenantId",
    ],
    // Legacy: SCIM writer predating standardization (no onBehalfOfId).
    [
      "action",
      "actorId",
      "actorEmail",
      "actorRole",
      "resourceType",
      "resourceId",
      "details",
      "ipAddress",
      "userAgent",
      "tenantId",
    ],
    // Legacy: Sprint B3 export writers (no onBehalfOfId/ipAddress/userAgent).
    [
      "action",
      "actorId",
      "actorEmail",
      "actorRole",
      "resourceType",
      "resourceId",
      "tenantId",
      "details",
    ],
  ],
};

export interface ChainRow {
  seq: number | bigint;
  prevHash: string | null;
  hash: string | null;
  [key: string]: unknown;
}

export interface ChainRangeResult {
  intact: boolean;
  /** Rows with a non-NULL hash that were recomputed. */
  checkedRows: number;
  /** Legacy pre-chain rows (NULL hash) skipped inside the range. */
  skippedLegacyRows: number;
  firstSeq: number | null;
  lastSeq: number | null;
  brokenAtSeq: number | null;
  /**
   * True when the slice's first prevHash was confirmed against the stored
   * hash of the row immediately before the range (or the range starts at
   * the chain head). False = the slice is internally consistent but its
   * anchor row predates the chain (NULL hash).
   */
  anchored: boolean;
}

function rowMatchesAnyProfile(
  row: ChainRow,
  prev: string,
  profiles: readonly (readonly string[])[],
): boolean {
  for (const keys of profiles) {
    const payload: Record<string, unknown> = {};
    for (const k of keys) payload[k] = row[k];
    if (computeAuditHash(prev, payload) === row.hash) return true;
  }
  return false;
}

/**
 * Verify an ordered, seq-contiguous slice of chain rows. `anchorHash` is
 * the stored hash of the row immediately preceding the slice (undefined
 * when the slice starts at the head of the table, null when the preceding
 * row is a pre-chain legacy row).
 */
export function verifyChainRows(
  rows: readonly ChainRow[],
  profiles: readonly (readonly string[])[],
  anchorHash?: string | null,
): ChainRangeResult {
  let prev: string | null = anchorHash === undefined ? "" : anchorHash;
  let anchored = anchorHash !== null;
  let checkedRows = 0;
  let skippedLegacyRows = 0;
  let firstSeq: number | null = null;
  let lastSeq: number | null = null;

  for (const row of rows) {
    if (row.hash == null) {
      // Pre-chain legacy row: the chain (re)starts at the next hashed row,
      // whose own prevHash becomes the trusted seed.
      skippedLegacyRows += 1;
      prev = null;
      anchored = false;
      continue;
    }
    const seq = Number(row.seq);
    if (firstSeq === null) firstSeq = seq;

    if (prev === null) {
      // No verifiable predecessor — seed from the row's claimed prevHash.
      prev = row.prevHash ?? "";
    } else if ((row.prevHash ?? "") !== prev) {
      return {
        intact: false,
        checkedRows,
        skippedLegacyRows,
        firstSeq,
        lastSeq,
        brokenAtSeq: seq,
        anchored,
      };
    }

    if (!rowMatchesAnyProfile(row, prev, profiles)) {
      return {
        intact: false,
        checkedRows,
        skippedLegacyRows,
        firstSeq,
        lastSeq,
        brokenAtSeq: seq,
        anchored,
      };
    }
    prev = row.hash;
    lastSeq = seq;
    checkedRows += 1;
  }

  return {
    intact: true,
    checkedRows,
    skippedLegacyRows,
    firstSeq,
    lastSeq,
    brokenAtSeq: null,
    anchored,
  };
}

export interface VerifyAuditChainRangeOptions {
  /** Inclusive createdAt lower bound. */
  from?: Date;
  /** Inclusive createdAt upper bound. */
  to?: Date;
  /** Override the table's writer profiles (defaults to AUDIT_CHAIN_PROFILES). */
  profiles?: readonly (readonly string[])[];
}

/**
 * Verify the hash chain of `tableName` over a createdAt range.
 *
 * The slice is taken by SEQ (derived from the date bounds) so it is always
 * chain-contiguous even when createdAt ordering and seq ordering disagree
 * by milliseconds under concurrency. The anchor row (latest row before the
 * slice) is fetched so the slice's first prevHash is confirmed against a
 * stored hash, not merely trusted.
 */
export async function verifyAuditChainRange(
  db: any,
  tableName: string,
  options: VerifyAuditChainRangeOptions = {},
): Promise<ChainRangeResult> {
  const profiles = options.profiles ?? AUDIT_CHAIN_PROFILES[tableName];
  if (!profiles || profiles.length === 0) {
    throw new Error(`verifyAuditChainRange: no writer profiles known for ${tableName}`);
  }
  const table = sql.identifier(tableName);
  // Raw-SQL params must be scalars (postgres.js does not serialize Date
  // instances outside column-typed builders), so bind ISO strings.
  const fromIso = options.from?.toISOString() ?? null;
  const toIso = options.to?.toISOString() ?? null;

  const bounds: any = await db.execute(sql`
    SELECT min(seq)::bigint AS min_seq, max(seq)::bigint AS max_seq
    FROM ${table}
    WHERE (${fromIso}::timestamptz IS NULL OR created_at >= ${fromIso}::timestamptz)
      AND (${toIso}::timestamptz IS NULL OR created_at <= ${toIso}::timestamptz)
  `);
  const boundsRow = Array.isArray(bounds) ? bounds[0] : bounds?.rows?.[0];
  if (!boundsRow || boundsRow.min_seq == null) {
    return {
      intact: true,
      checkedRows: 0,
      skippedLegacyRows: 0,
      firstSeq: null,
      lastSeq: null,
      brokenAtSeq: null,
      anchored: true,
    };
  }
  const minSeq = Number(boundsRow.min_seq);
  const maxSeq = Number(boundsRow.max_seq);

  const anchorRes: any = await db.execute(
    sql`SELECT hash FROM ${table} WHERE seq < ${minSeq} ORDER BY seq DESC LIMIT 1`,
  );
  const anchorRow = Array.isArray(anchorRes) ? anchorRes[0] : anchorRes?.rows?.[0];
  // No preceding row → head of chain (genesis ""); preceding legacy row
  // (NULL hash) → unanchored seed from the slice's own prevHash.
  const anchorHash: string | null | undefined =
    anchorRow === undefined ? undefined : (anchorRow.hash ?? null);

  const sliceRes: any = await db.execute(
    sql`SELECT * FROM ${table} WHERE seq >= ${minSeq} AND seq <= ${maxSeq} ORDER BY seq ASC`,
  );
  const sliceRaw: any[] = Array.isArray(sliceRes) ? sliceRes : (sliceRes?.rows ?? []);
  // db.execute returns snake_case column names; the hash profiles use the
  // drizzle camelCase field names, so normalize before verification.
  const slice: ChainRow[] = sliceRaw.map((r) => normalizeRow(r));
  return verifyChainRows(slice, profiles, anchorHash);
}

function normalizeRow(raw: Record<string, unknown>): ChainRow {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    out[snakeToCamel(key)] = value;
  }
  return out as ChainRow;
}

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}
