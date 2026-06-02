/**
 * Sprint 2 — reconciliation / orphan detection.
 *
 * Compares the set of sourcedIds the connector last surfaced (the "known"
 * internal set, from the mapping table) against the incoming snapshot. Any
 * known id absent from the incoming snapshot is an orphan: a record the SIS
 * has dropped without an explicit `tobedeleted`. Orphans are returned so
 * the apply stage can soft-delete them (never hard-delete).
 *
 * A safety floor guards against a connector that returns an empty/partial
 * payload (provider outage): if the incoming snapshot is empty for a kind
 * that previously had records, we refuse to orphan the whole population and
 * flag it for review instead.
 */
import { ENTITY_KINDS, type EntityKind, type RosterSnapshot } from "../types/canonical.js";

export interface ReconcileInput {
  /** sourcedIds AIVO currently has mapped for this provider+tenant, per kind. */
  known: Record<EntityKind, string[]>;
  /** The freshly-extracted snapshot. */
  incoming: RosterSnapshot;
}

export interface ReconcileResult {
  orphans: Record<EntityKind, string[]>;
  /** Kinds where reconciliation was skipped because the incoming set was
   *  empty while the known set was not (suspected provider outage). */
  suspectedOutage: EntityKind[];
  totalOrphans: number;
}

export function reconcile(input: ReconcileInput): ReconcileResult {
  const orphans = {} as Record<EntityKind, string[]>;
  const suspectedOutage: EntityKind[] = [];
  let totalOrphans = 0;

  for (const kind of ENTITY_KINDS) {
    const known = new Set(input.known[kind] ?? []);
    const incomingIds = new Set(
      (input.incoming[kind] as Array<{ sourcedId: string }>).map((r) => r.sourcedId),
    );

    if (incomingIds.size === 0 && known.size > 0) {
      // Refuse to orphan an entire population on an empty payload.
      suspectedOutage.push(kind);
      orphans[kind] = [];
      continue;
    }

    const list: string[] = [];
    for (const id of known) {
      if (!incomingIds.has(id)) list.push(id);
    }
    list.sort();
    orphans[kind] = list;
    totalOrphans += list.length;
  }

  return { orphans, suspectedOutage, totalOrphans };
}
