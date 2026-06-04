/**
 * Sprint 2 — diff stage. Computes add/update/delete sets between the prior
 * canonical snapshot (what we last loaded) and the incoming one, keyed by
 * sourcedId. Change detection uses the stable fingerprint from transform.
 *
 * A record present in `prev` but absent in `next` is a removal; a record
 * with `status: "tobedeleted"` is also treated as a removal regardless of
 * presence. Removals are realised as soft-deletes downstream (apply).
 */
import { ENTITY_KINDS, type EntityKind, type RosterSnapshot } from "../types/canonical.js";
import { fingerprint } from "./transform.js";

export interface EntityDiff<T> {
  added: T[];
  updated: T[];
  removed: T[];
}

export type SyncDiff = {
  [K in EntityKind]: EntityDiff<RosterSnapshot[K][number]>;
} & {
  counts: Record<EntityKind, { added: number; updated: number; removed: number }>;
  total: number;
};

function diffKind<T extends { sourcedId: string; status: string }>(
  prev: T[],
  next: T[],
): EntityDiff<T> {
  const prevById = new Map(prev.map((x) => [x.sourcedId, x]));
  const nextById = new Map(next.map((x) => [x.sourcedId, x]));
  const added: T[] = [];
  const updated: T[] = [];
  const removed: T[] = [];

  for (const [id, n] of nextById) {
    if (n.status === "tobedeleted") {
      if (prevById.has(id)) removed.push(n);
      continue;
    }
    const p = prevById.get(id);
    if (!p) added.push(n);
    else if (fingerprint(p) !== fingerprint(n)) updated.push(n);
  }
  for (const [id, p] of prevById) {
    const n = nextById.get(id);
    if (!n || n.status === "tobedeleted") {
      // Only count an explicit removal once (the tobedeleted case above
      // already pushed when present in next).
      if (!n) removed.push(p);
    }
  }
  return { added, updated, removed };
}

export function computeDiff(prev: RosterSnapshot, next: RosterSnapshot): SyncDiff {
  const out = {} as SyncDiff;
  out.counts = {} as SyncDiff["counts"];
  let total = 0;
  for (const kind of ENTITY_KINDS) {
    const d = diffKind(prev[kind] as any[], next[kind] as any[]);
    (out as any)[kind] = d;
    out.counts[kind] = {
      added: d.added.length,
      updated: d.updated.length,
      removed: d.removed.length,
    };
    total += d.added.length + d.updated.length + d.removed.length;
  }
  out.total = total;
  return out;
}

/** True when the diff contains no changes (idempotent second run). */
export function isEmptyDiff(diff: SyncDiff): boolean {
  return diff.total === 0;
}
