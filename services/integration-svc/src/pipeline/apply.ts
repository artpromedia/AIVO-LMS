/**
 * Sprint 2 — apply stage. Realises a {@link SyncDiff} against a pluggable
 * {@link RosterWriter} (identity-svc / tenant-svc upserts), with the
 * sprint's safety rails:
 *
 *   - Soft-delete only: removals call `softDelete`, never a hard delete.
 *   - Mutation cap: if a run would mutate more than `maxMutationRatio` of
 *     the known tenant population (default 10%), the run PAUSES and writes
 *     nothing — a platform admin must approve via `overrideCap`.
 *   - Dry-run: compute the plan and emit events without writing.
 *
 * The writer is a port so the pure planning logic here is unit-testable
 * with an in-memory fake, and the real DB/queue wiring lives behind it.
 */
import { ENTITY_KINDS, type EntityKind } from "../types/canonical.js";
import type { SyncDiff } from "./diff.js";

export interface RosterWriter {
  upsert(kind: EntityKind, record: { sourcedId: string }): Promise<void>;
  /** Soft-delete: mark inactive with an effective date; never hard-delete. */
  softDelete(kind: EntityKind, record: { sourcedId: string }, effectiveDate: string): Promise<void>;
}

export interface ApplyOptions {
  /** Known tenant population (used for the mutation-cap denominator). */
  population: number;
  /** Max fraction of population a single run may mutate. Default 0.10. */
  maxMutationRatio?: number;
  /** Bypass the cap (platform-admin approved). */
  overrideCap?: boolean;
  /** Compute the plan + emit events without writing. */
  dryRun?: boolean;
  /** Effective date stamped on soft-deletes. Default now (ISO). */
  effectiveDate?: string;
}

export interface ApplyResult {
  applied: boolean;
  paused: boolean;
  dryRun: boolean;
  mutations: number;
  population: number;
  ratio: number;
  capRatio: number;
  pauseReason?: string;
  counts: SyncDiff["counts"];
}

export function mutationCount(diff: SyncDiff): number {
  return diff.total;
}

/**
 * Decide whether a diff exceeds the mutation cap. Pure — surfaced so the
 * route/queue layer can warn before invoking `applyDiff`.
 */
export function exceedsCap(
  diff: SyncDiff,
  population: number,
  maxMutationRatio = 0.1,
): { exceeds: boolean; ratio: number } {
  const mutations = mutationCount(diff);
  // With no known population we can't compute a ratio; treat as unbounded
  // only when there is actually something to write.
  const ratio = population > 0 ? mutations / population : mutations > 0 ? Infinity : 0;
  return { exceeds: ratio > maxMutationRatio, ratio };
}

export async function applyDiff(
  diff: SyncDiff,
  writer: RosterWriter,
  opts: ApplyOptions,
): Promise<ApplyResult> {
  const capRatio = opts.maxMutationRatio ?? 0.1;
  const mutations = mutationCount(diff);
  const { exceeds, ratio } = exceedsCap(diff, opts.population, capRatio);
  const base: Omit<ApplyResult, "applied" | "paused" | "pauseReason"> = {
    dryRun: !!opts.dryRun,
    mutations,
    population: opts.population,
    ratio,
    capRatio,
    counts: diff.counts,
  };

  if (exceeds && !opts.overrideCap) {
    return {
      ...base,
      applied: false,
      paused: true,
      pauseReason: `Run would mutate ${mutations} records (${(ratio * 100).toFixed(1)}% of ${opts.population}), exceeding the ${(capRatio * 100).toFixed(0)}% cap. Awaiting platform-admin approval.`,
    };
  }

  if (opts.dryRun) {
    return { ...base, applied: false, paused: false };
  }

  const effectiveDate = opts.effectiveDate ?? new Date().toISOString();
  // Apply in dependency order: orgs/terms/courses/classes/users before
  // enrollments so referential writes resolve.
  for (const kind of ENTITY_KINDS) {
    const d = (diff as any)[kind] as {
      added: Array<{ sourcedId: string }>;
      updated: Array<{ sourcedId: string }>;
      removed: Array<{ sourcedId: string }>;
    };
    for (const rec of d.added) await writer.upsert(kind, rec);
    for (const rec of d.updated) await writer.upsert(kind, rec);
    for (const rec of d.removed) await writer.softDelete(kind, rec, effectiveDate);
  }
  return { ...base, applied: true, paused: false };
}
