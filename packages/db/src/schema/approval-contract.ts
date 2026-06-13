/**
 * Sprint C-12 (ADR 0042) — the shared approval/consent contract.
 *
 * One definition of "is this child's profile approved, by whom, under which
 * consent?", honoured by BOTH lesson pipelines:
 *
 *   - web-v2 (`apps/web-v2/lib/db/repos.ts: createLessonRun`) gates the live
 *     surface on it;
 *   - the services side (`services/learning-svc/.../sessions.ts` path-init,
 *     `services/brain-svc/.../routes/brain.py`) gates lesson/path init on it.
 *
 * There is no shared TS↔Python codegen in this repo, so the Python mirror
 * (`services/brain-svc/src/brain_svc/contracts/approval_contract.py`) restates
 * these exact constants and a parity test on each side fails CI on drift. ADR
 * 0042 is the human-readable parity record.
 *
 * This module is dependency-free (no drizzle/zod imports) so it can be consumed
 * anywhere — a route guard, a validator, a test — without dragging the schema
 * graph along. The canonical *table* shape lives in
 * `./brain-profile-approvals.ts` (migration 0108); this is its typed contract.
 */

/**
 * The full approval lifecycle of a learner's brain profile. Mirrors
 * `brainApprovalStatusEnum` (`./enums.ts`) and brain-svc's
 * `brain_states.approval_status`.
 */
export const BRAIN_APPROVAL_STATUSES = [
  "pending_parent_review",
  "approved",
  "amended",
  "declined",
] as const;
export type BrainApprovalStatus = (typeof BRAIN_APPROVAL_STATUSES)[number];

/**
 * The sub-set of statuses from which a lesson pipeline MAY teach. An amendment
 * is an accepted profile carrying parent overrides — it teaches. A profile that
 * is still `pending_parent_review` or has been `declined` MUST NOT teach.
 *
 * This is THE teach gate's decision set, asserted server-side against every
 * lesson pipeline (web `createLessonRun`, services path-init/lesson entry).
 */
export const TEACHING_APPROVAL_STATUSES = ["approved", "amended"] as const;
export type TeachingApprovalStatus = (typeof TEACHING_APPROVAL_STATUSES)[number];

/**
 * The action a single approval *record* (`brain_profile_approvals`) captures.
 * A decline is recorded too (it archives — C-06), but it is never a teaching
 * status. Distinct from the lifecycle status above: this is what the parent
 * *did*, recorded as audit evidence.
 */
export const APPROVAL_RECORD_ACTIONS = ["approved", "amended", "declined"] as const;
export type ApprovalRecordAction = (typeof APPROVAL_RECORD_ACTIONS)[number];

/**
 * The canonical field list of a shared approval record. Both stacks construct a
 * record with exactly these fields (web-v2 `BrainProfileApproval`; brain-svc
 * `BrainProfileApprovalRecord`). Kept as a literal so the parity tests can
 * assert the two stacks agree on the shape, not just the enums.
 */
export const APPROVAL_RECORD_FIELDS = [
  "id",
  "tenantId",
  "learnerId",
  "brainProfileId",
  "profileRevision",
  "actorUserId",
  "action",
  "consentVersion",
  "raiVersion",
  "modifications",
  "ipHash",
  "createdAt",
] as const;

/** The shared approval record contract (the C-06 `brain_profile_approvals` shape). */
export interface ApprovalContractRecord {
  id: string;
  tenantId: string;
  learnerId: string;
  brainProfileId: string;
  /** The `LearnerBrainProfile.revision` / brain_state version the parent reviewed. */
  profileRevision: number;
  actorUserId: string;
  action: ApprovalRecordAction;
  /** Version string of the COPPA consent copy the parent agreed to. */
  consentVersion: string;
  /** Version of the Responsible-AI disclosures acknowledged. */
  raiVersion: string;
  /** Field-level corrections folded at approval; [] for a plain approve / a decline. */
  modifications: unknown[];
  /** SHA-256 of the request IP — raw IP is never stored. May be null. */
  ipHash: string | null;
  createdAt: string;
}

/** True iff a profile in `status` is allowed to teach. THE teach-gate predicate. */
export function canTeach(status: string | null | undefined): status is TeachingApprovalStatus {
  return (
    status != null && (TEACHING_APPROVAL_STATUSES as readonly string[]).includes(status)
  );
}

/** True iff `status` is a recognised lifecycle status. */
export function isApprovalStatus(status: string | null | undefined): status is BrainApprovalStatus {
  return status != null && (BRAIN_APPROVAL_STATUSES as readonly string[]).includes(status);
}

/** True iff `action` is a recognised approval-record action. */
export function isApprovalRecordAction(
  action: string | null | undefined,
): action is ApprovalRecordAction {
  return action != null && (APPROVAL_RECORD_ACTIONS as readonly string[]).includes(action);
}

/**
 * Validate an arbitrary object against the shared approval-record contract.
 * Returns `{ ok: true, record }` on success, or `{ ok: false, errors }` listing
 * every violated field. Used by brain-svc's parity assertion and as a
 * defensive validator before persisting a record. Does not coerce — a wrong
 * type is an error, not a silent fix.
 */
export function parseApprovalRecord(
  input: unknown,
): { ok: true; record: ApprovalContractRecord } | { ok: false; errors: string[] } {
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
  str("actorUserId");
  str("consentVersion");
  str("raiVersion");
  str("createdAt");
  if (typeof o.profileRevision !== "number" || !Number.isFinite(o.profileRevision)) {
    errors.push("profileRevision must be a finite number");
  }
  if (!isApprovalRecordAction(o.action as string)) {
    errors.push(`action must be one of ${APPROVAL_RECORD_ACTIONS.join(", ")}`);
  }
  if (!Array.isArray(o.modifications)) {
    errors.push("modifications must be an array");
  }
  if (o.ipHash !== null && typeof o.ipHash !== "string") {
    errors.push("ipHash must be a string or null");
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, record: o as unknown as ApprovalContractRecord };
}
