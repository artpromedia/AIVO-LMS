/**
 * Sprint 2 — sync orchestrator. Ties extract → normalize → reconcile → diff
 * → apply with **checkpointing** so a worker killed mid-run resumes from the
 * last completed entity kind without duplicating writes.
 *
 * Resume safety rests on two properties:
 *   1. Writes are idempotent (upserts keyed by (provider, sourcedId)), so
 *      re-applying a partially-completed kind is harmless.
 *   2. A per-kind checkpoint lets resume skip already-completed kinds
 *      entirely, so a clean resume performs zero redundant writes.
 *
 * The mutation cap is evaluated up front: an over-cap run pauses and writes
 * nothing until a platform admin approves.
 */
import { ENTITY_KINDS, type EntityKind, type RosterSnapshot } from "../types/canonical.js";
import { normalizeSnapshot } from "./transform.js";
import { computeDiff, type SyncDiff } from "./diff.js";
import { exceedsCap, type RosterWriter } from "./apply.js";

export interface SyncCheckpoint {
  runId: string;
  completedKinds: EntityKind[];
}

export interface CheckpointStore {
  load(runId: string): Promise<SyncCheckpoint | null>;
  save(cp: SyncCheckpoint): Promise<void>;
}

/** In-memory checkpoint store for tests / single-process dev. */
export class InMemoryCheckpointStore implements CheckpointStore {
  private map = new Map<string, SyncCheckpoint>();
  async load(runId: string) {
    return this.map.get(runId) ?? null;
  }
  async save(cp: SyncCheckpoint) {
    this.map.set(cp.runId, { runId: cp.runId, completedKinds: [...cp.completedKinds] });
  }
}

export interface RunSyncOptions {
  runId: string;
  prev: RosterSnapshot;
  next: RosterSnapshot;
  writer: RosterWriter;
  checkpoint: CheckpointStore;
  population: number;
  maxMutationRatio?: number;
  overrideCap?: boolean;
  effectiveDate?: string;
}

export interface RunSyncResult {
  applied: boolean;
  paused: boolean;
  pauseReason?: string;
  resumedFrom: EntityKind[];
  appliedKinds: EntityKind[];
  counts: SyncDiff["counts"];
  diff: SyncDiff;
}

export async function runSync(opts: RunSyncOptions): Promise<RunSyncResult> {
  const prev = normalizeSnapshot(opts.prev);
  const next = normalizeSnapshot(opts.next);
  const diff = computeDiff(prev, next);

  const capRatio = opts.maxMutationRatio ?? 0.1;
  const { exceeds, ratio } = exceedsCap(diff, opts.population, capRatio);
  if (exceeds && !opts.overrideCap) {
    return {
      applied: false,
      paused: true,
      pauseReason: `Run would mutate ${diff.total} records (${(ratio * 100).toFixed(1)}% of ${opts.population}), exceeding the ${(capRatio * 100).toFixed(0)}% cap.`,
      resumedFrom: [],
      appliedKinds: [],
      counts: diff.counts,
      diff,
    };
  }

  const cp = (await opts.checkpoint.load(opts.runId)) ?? { runId: opts.runId, completedKinds: [] };
  const done = new Set<EntityKind>(cp.completedKinds);
  const resumedFrom = [...done];
  const appliedKinds: EntityKind[] = [];
  const effectiveDate = opts.effectiveDate ?? new Date().toISOString();

  for (const kind of ENTITY_KINDS) {
    if (done.has(kind)) continue; // resume: skip already-completed kinds
    const d = (
      diff as unknown as Record<
        EntityKind,
        {
          added: Array<{ sourcedId: string }>;
          updated: Array<{ sourcedId: string }>;
          removed: Array<{ sourcedId: string }>;
        }
      >
    )[kind];
    for (const rec of d.added) await opts.writer.upsert(kind, rec);
    for (const rec of d.updated) await opts.writer.upsert(kind, rec);
    for (const rec of d.removed) await opts.writer.softDelete(kind, rec, effectiveDate);
    done.add(kind);
    appliedKinds.push(kind);
    await opts.checkpoint.save({ runId: opts.runId, completedKinds: [...done] });
  }

  return { applied: true, paused: false, resumedFrom, appliedKinds, counts: diff.counts, diff };
}
