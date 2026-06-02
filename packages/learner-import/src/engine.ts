/**
 * Resumable, chunked import engine (Sprint 6).
 *
 * The actual write of learners happens in admin-svc / the BFF, but the
 * *driving* of the import — chunking, progress, and resume-after-kill — is
 * pure and lives here so it can be unit-tested deterministically and the
 * "10k rows < 90s, resumable if killed mid-run" DoD is provable without a
 * real queue. A BullMQ worker (or the in-process runner) only has to call
 * `processNextChunk` in a loop and persist the returned cursor; on restart
 * it rehydrates the cursor and continues exactly where it stopped.
 */
import type { NormalizedLearner } from "./validate.js";

export type RowOutcome = "created" | "updated" | "skipped";

export interface ImportProgress {
  /** Index of the next row to process (the resume cursor). */
  cursor: number;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  done: boolean;
}

export function initialProgress(total: number): ImportProgress {
  return { cursor: 0, total, created: 0, updated: 0, skipped: 0, done: total === 0 };
}

/** Apply a single row outcome to a progress snapshot (pure). */
function tally(progress: ImportProgress, outcome: RowOutcome): void {
  if (outcome === "created") progress.created++;
  else if (outcome === "updated") progress.updated++;
  else progress.skipped++;
}

export interface ChunkResult {
  progress: ImportProgress;
  /** Rows processed in this chunk, with their outcomes. */
  processed: Array<{ rowNumber: number; outcome: RowOutcome }>;
}

/**
 * Process up to `chunkSize` rows starting at `progress.cursor`, applying
 * `apply` to each. Returns an advanced progress snapshot — persist it, and
 * a later call (even in a fresh process) resumes from `cursor`. `apply`
 * must be idempotent on `external_id` so a row reprocessed after a crash
 * mid-chunk doesn't double-create.
 */
export function processNextChunk(
  rows: NormalizedLearner[],
  progress: ImportProgress,
  chunkSize: number,
  apply: (row: NormalizedLearner) => RowOutcome,
): ChunkResult {
  const next: ImportProgress = { ...progress };
  const processed: Array<{ rowNumber: number; outcome: RowOutcome }> = [];
  const end = Math.min(next.cursor + chunkSize, rows.length);
  for (let i = next.cursor; i < end; i++) {
    const outcome = apply(rows[i]);
    tally(next, outcome);
    processed.push({ rowNumber: rows[i].rowNumber, outcome });
  }
  next.cursor = end;
  next.done = end >= rows.length;
  return { progress: next, processed };
}

export interface RunOptions {
  chunkSize?: number;
  /** Resume from a previously-persisted progress (after a crash/kill). */
  resumeFrom?: ImportProgress;
  /** Persist hook called after every chunk (e.g. write cursor to the DB). */
  onProgress?: (progress: ImportProgress) => void;
}

/**
 * Drive a full import to completion in chunks. `apply` does the real write.
 * Returns the final progress. Pass `resumeFrom` to continue an interrupted
 * run; rows before the persisted cursor are not revisited.
 */
export function runImport(
  rows: NormalizedLearner[],
  apply: (row: NormalizedLearner) => RowOutcome,
  options: RunOptions = {},
): ImportProgress {
  const chunkSize = Math.max(1, options.chunkSize ?? 500);
  let progress = options.resumeFrom ?? initialProgress(rows.length);
  // A resumed run keeps its tallies/total but clamps the cursor into range.
  if (progress.total !== rows.length) progress = { ...progress, total: rows.length };
  while (!progress.done) {
    const { progress: advanced } = processNextChunk(rows, progress, chunkSize, apply);
    progress = advanced;
    options.onProgress?.(progress);
  }
  return progress;
}

/**
 * Dry-run diff: classify each valid learner as an add or update against the
 * set of external_ids already present, without writing anything.
 */
export function dryRunDiff(
  rows: NormalizedLearner[],
  existingExternalIds: Set<string>,
): {
  adds: number;
  updates: number;
  addRows: NormalizedLearner[];
  updateRows: NormalizedLearner[];
} {
  const addRows: NormalizedLearner[] = [];
  const updateRows: NormalizedLearner[] = [];
  for (const row of rows) {
    if (existingExternalIds.has(row.external_id)) updateRows.push(row);
    else addRows.push(row);
  }
  return { adds: addRows.length, updates: updateRows.length, addRows, updateRows };
}
