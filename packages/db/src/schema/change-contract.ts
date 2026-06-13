/**
 * Sprint C-13 (ADR 0042-aligned) — the shared brain-profile CHANGE contract.
 *
 * One definition of "what changed in this child's profile, was it structural,
 * and does the parent need to re-acknowledge the delta?", honoured wherever a
 * brain profile mutates:
 *
 *   - web-v2 (`apps/web-v2/lib/db/repos.ts`) captures a change record at every
 *     structural mutation path (re-clone, regenerate, IEP-derived shift) and a
 *     cheap mastery record otherwise, then renders the "what changed since you
 *     approved" timeline from them;
 *   - the services side (`services/brain-svc/.../routes/brain.py`) emits the
 *     same-shaped record at its engagement / amend / regression write paths.
 *
 * As with the C-12 approval contract there is no shared TS↔Python codegen, so
 * the Python mirror (`services/brain-svc/src/brain_svc/contracts/change_contract.py`)
 * restates these exact constants and a parity test on each side fails CI on
 * drift. This module is dependency-free so it can be consumed anywhere — a
 * route, a validator, a test — without dragging the schema graph along. The
 * canonical *table* shape lives in `./brain-profile-changes.ts` (migration 0115).
 */

/**
 * The kind of change. `mastery` changes flow freely (recorded for the timeline,
 * `requiresAck: false`, never emailed). `structural` changes — functioning
 * level, accommodations added/removed, tutor activation, IEP-derived shifts —
 * set `requiresAck: true` on the DELTA and notify the parent (non-blocking).
 */
export const BRAIN_CHANGE_KINDS = ["mastery", "structural"] as const;
export type BrainChangeKind = (typeof BRAIN_CHANGE_KINDS)[number];

/**
 * Where a change originated. Parent-authored corrections (C-05) are deliberately
 * NOT a source — an amendment the parent made themselves is never a
 * notify-to-self. `amendment` here is the brain-svc parent-amend write path,
 * which is RECORDED for the timeline but never `requiresAck`.
 */
export const BRAIN_CHANGE_SOURCES = [
  "baseline_reclone",
  "regenerate",
  "iep_update",
  "engagement_sync",
  "regression_detected",
  "amendment",
  "rollback",
] as const;
export type BrainChangeSource = (typeof BRAIN_CHANGE_SOURCES)[number];

/**
 * The default acknowledgement window for a structural change, in days. Chosen
 * at 14 (two weeks) as the balance between "long enough that a parent who
 * travels or has a busy fortnight is never nagged or surprised" and "short
 * enough that an un-reviewed structural shift doesn't sit silently for a
 * month". The window is NON-BLOCKING: teaching never stops when it lapses — the
 * pending delta simply escalates from a one-time reminder to a persistent
 * in-app badge until the parent acknowledges. Surfaced in ADR 0042's change
 * addendum so both stacks agree on the figure.
 */
export const BRAIN_CHANGE_ACK_WINDOW_DAYS = 14;

/**
 * After this many days an un-acked structural change earns ONE digest reminder
 * (ledger-capped, like C-08's invite jobs). Strictly less than the ack window
 * so the reminder lands while the window is still open.
 */
export const BRAIN_CHANGE_REMINDER_AFTER_DAYS = 7;

/**
 * The canonical field list of a shared change record. Both stacks construct a
 * record with exactly these fields (camelCase — the wire/record shape). Kept as
 * a literal so the parity tests can assert the two stacks agree on the shape.
 */
export const BRAIN_CHANGE_RECORD_FIELDS = [
  "id",
  "tenantId",
  "learnerId",
  "brainProfileId",
  "revision",
  "kind",
  "fields",
  "summary",
  "source",
  "requiresAck",
  "ackedAt",
  "reminderSentAt",
  "createdAt",
] as const;

/** The shared change-record contract (the `brain_profile_changes` shape). */
export interface BrainChangeContractRecord {
  id: string;
  tenantId: string;
  learnerId: string;
  brainProfileId: string;
  /** The `LearnerBrainProfile.revision` / brain_state version this change produced. */
  revision: number;
  kind: BrainChangeKind;
  /** Changed field paths (e.g. ["accommodation.read_aloud", "functioningLevel"]). */
  fields: string[];
  /** Plain-language, strengths-first summary of what changed and why. */
  summary: string;
  source: BrainChangeSource;
  /** True only for structural changes — the parent must acknowledge the delta. */
  requiresAck: boolean;
  /** ISO timestamp when the parent acknowledged the delta; null while pending. */
  ackedAt: string | null;
  /** ISO timestamp when the 7-day digest reminder was sent; null until latched. */
  reminderSentAt: string | null;
  createdAt: string;
}

/** True iff `kind` is a recognised change kind. */
export function isBrainChangeKind(kind: string | null | undefined): kind is BrainChangeKind {
  return kind != null && (BRAIN_CHANGE_KINDS as readonly string[]).includes(kind);
}

/** True iff `source` is a recognised change source. */
export function isBrainChangeSource(
  source: string | null | undefined,
): source is BrainChangeSource {
  return source != null && (BRAIN_CHANGE_SOURCES as readonly string[]).includes(source);
}

/**
 * A structural change is the ONLY kind that requires acknowledgement. This is
 * the single predicate both stacks use to decide `requiresAck` so the rule
 * cannot drift: structural ⇒ requiresAck, mastery ⇒ free.
 */
export function changeRequiresAck(kind: string | null | undefined): boolean {
  return kind === "structural";
}

/**
 * Validate an arbitrary object against the shared change-record contract.
 * Returns `{ ok: true, record }` on success, or `{ ok: false, errors }` listing
 * every violated field. Used by brain-svc's parity assertion and as a defensive
 * validator before persisting. Does not coerce — a wrong type is an error.
 */
export function parseBrainChangeRecord(
  input: unknown,
): { ok: true; record: BrainChangeContractRecord } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: ["record must be a non-null object"] };
  }
  const o = input as Record<string, unknown>;
  const str = (k: string) => {
    if (typeof o[k] !== "string" || (o[k] as string).length === 0) {
      errors.push(`${k} must be a non-empty string`);
    }
  };
  str("id");
  str("tenantId");
  str("learnerId");
  str("brainProfileId");
  str("summary");
  str("createdAt");
  if (typeof o.revision !== "number" || !Number.isFinite(o.revision)) {
    errors.push("revision must be a finite number");
  }
  if (!isBrainChangeKind(o.kind as string)) {
    errors.push(`kind must be one of ${BRAIN_CHANGE_KINDS.join(", ")}`);
  }
  if (!isBrainChangeSource(o.source as string)) {
    errors.push(`source must be one of ${BRAIN_CHANGE_SOURCES.join(", ")}`);
  }
  if (!Array.isArray(o.fields) || !o.fields.every((f) => typeof f === "string")) {
    errors.push("fields must be an array of strings");
  }
  if (typeof o.requiresAck !== "boolean") {
    errors.push("requiresAck must be a boolean");
  }
  if (o.ackedAt !== null && typeof o.ackedAt !== "string") {
    errors.push("ackedAt must be a string or null");
  }
  if (o.reminderSentAt !== null && typeof o.reminderSentAt !== "string") {
    errors.push("reminderSentAt must be a string or null");
  }
  // Enforce the cross-stack invariant: requiresAck iff structural.
  if (
    isBrainChangeKind(o.kind as string) &&
    typeof o.requiresAck === "boolean" &&
    o.requiresAck !== changeRequiresAck(o.kind as string)
  ) {
    errors.push("requiresAck must equal (kind === 'structural')");
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, record: o as unknown as BrainChangeContractRecord };
}
