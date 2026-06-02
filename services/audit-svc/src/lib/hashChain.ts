/**
 * Sprint 3 — audit hash chain.
 *
 * Each event stores `prev_hash` (the previous event's hash) and
 * `hash = sha256(prev_hash || canonical(payload))`, where the payload is the
 * event minus the chain fields. Walking the chain detects any tamper —
 * insert, update, delete, or reorder. Built on `@aivo/security`'s
 * `computeAuditHash`/`canonicalize` so the algorithm matches the rest of the
 * platform's append-only logs.
 *
 * A daily anchor (the latest hash + count) is written to a WORM / object-lock
 * store so even a full-table rewrite is detectable against the external
 * anchor.
 */
import { computeAuditHash } from "@aivo/security";
import type { AuditEvent } from "@aivo/audit-client";

/** Event fields covered by the hash (everything except the chain fields). */
export const PAYLOAD_KEYS = [
  "id",
  "occurred_at",
  "tenant_id",
  "actor",
  "action",
  "entity",
  "outcome",
  "details",
  "request_id",
] as const;

export type ChainPayload = Omit<AuditEvent, "prev_hash" | "hash">;

function payloadOf(event: ChainPayload): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of PAYLOAD_KEYS) out[k] = (event as Record<string, unknown>)[k];
  return out;
}

/** Compute the hash for an event given the previous event's hash. */
export function hashEvent(prevHash: string, event: ChainPayload): string {
  return computeAuditHash(prevHash, payloadOf(event));
}

/** The genesis prev_hash for the very first event in a chain. */
export const GENESIS_HASH = "";

export interface ChainBreak {
  index: number;
  id: string;
  reason: "hash-mismatch" | "prev-hash-mismatch";
}

/**
 * Verify a contiguous, time-ordered slice of the chain. Returns the first
 * break found, or `null` when the slice is intact. `expectedFirstPrevHash`
 * is the hash of the event immediately preceding the slice (GENESIS for the
 * head of the chain).
 */
export function verifyChain(
  events: AuditEvent[],
  expectedFirstPrevHash: string = GENESIS_HASH,
): ChainBreak | null {
  let prev = expectedFirstPrevHash;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.prev_hash !== prev) {
      return { index: i, id: e.id, reason: "prev-hash-mismatch" };
    }
    const recomputed = hashEvent(e.prev_hash, e);
    if (recomputed !== e.hash) {
      return { index: i, id: e.id, reason: "hash-mismatch" };
    }
    prev = e.hash;
  }
  return null;
}
