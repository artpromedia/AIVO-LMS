/**
 * Audit hash-chain helpers (Sprint 4).
 *
 * Each audit row stores `prevHash` (the hash of the previous row) and
 * `hash = sha256(prevHash || canonicalJSON(payload))`. Walking the chain
 * detects any tampering (insert / update / delete that bypassed the
 * append-only triggers).
 */
import crypto from "crypto";

/**
 * Stable canonical JSON: keys sorted, undefined dropped, no whitespace.
 * Used so reordering of object keys cannot produce a different hash for
 * the same logical payload.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sort(value));
}

function sort(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sort);
  if (v && typeof v === "object" && !(v instanceof Date)) {
    const obj = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      if (obj[k] === undefined) continue;
      out[k] = sort(obj[k]);
    }
    return out;
  }
  if (v instanceof Date) return v.toISOString();
  return v;
}

/**
 * Compute the next chain hash. `prevHash` is the previous row's `hash` (empty
 * string for the genesis row). `payload` is the audit row's content
 * excluding the chain fields themselves.
 */
export function computeAuditHash(prevHash: string | null | undefined, payload: unknown): string {
  const prev = prevHash ?? "";
  const body = canonicalize(payload);
  return crypto.createHash("sha256").update(prev).update(body).digest("hex");
}

/**
 * Verify a single row's hash matches its declared `prevHash` + payload.
 * Returns `true` when the row is intact.
 */
export function verifyAuditRow(
  row: { prevHash: string | null; hash: string | null; [k: string]: unknown },
  payloadKeys: readonly string[],
): boolean {
  if (!row.hash) return false;
  const payload: Record<string, unknown> = {};
  for (const k of payloadKeys) payload[k] = row[k];
  return computeAuditHash(row.prevHash, payload) === row.hash;
}
