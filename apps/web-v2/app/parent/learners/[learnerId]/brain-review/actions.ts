"use server";

/**
 * BrainReview server actions (BrainReview.dc.html).
 *
 * The handoff merges the parent's pre-clone review + corrections AND the
 * COPPA/FERPA consent + "Approve & Create Virtual Brain" into one screen. Both
 * actions here submit NATIVE form fields (`value:<field>` deny inputs +
 * `note:<field>` textareas + consent/RAI flags), so the review survives without
 * client JS, and both reuse the existing, legally-vetted server core:
 *
 *   - `stageReviewAction`   → stage the parent's corrections (removed tags +
 *     context / change-request notes) as a resume-safe draft, then route to the
 *     clone-watch recap which shows the held/"we'll revise" state.
 *   - `approveFromReviewAction` → stage any corrections, then run
 *     `performBrainApproval` (the same trust-gate + fold + audit + approval
 *     record used by the clone-watch ceremony) and land on the celebration.
 *
 * Therapist-pinned supports are rejected server-side by `stageBrainCorrections`
 * (`BrainCorrectionLockedError`) — the disabled UI chip is a courtesy, not the
 * defense. Removed "superpower" tags + free-text concerns are recorded as
 * auditable corrections but never folded into typed state (parity with the
 * brain-svc route, which records unknown fields without applying them).
 */
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requirePageRole } from "@/lib/auth/server";
import { getBrainProfile, parentCanAccessLearner, stageBrainCorrections } from "@/lib/db/repos";
import { BrainCorrectionLockedError, originalValueForField } from "@/lib/db/brain-corrections";
import type { LearnerBrainProfileState, ParentModification } from "@/lib/db/types";
import { audit } from "@/lib/bff/audit";
import { hashIpFromHeaders } from "@/lib/bff/consent-guard";
import { revealAction } from "@/lib/learner/reveal-telemetry";
import { newRequestId, logger } from "@/lib/observability/logger";
import { performBrainApproval, BRAIN_CONSENT_VERSION } from "../brain-clone-watch/approve-action";

const COMFORT_FIELDS = new Set(["readingComfort", "mathComfort"]);
const COMFORT_VALUES = new Set(["new", "growing", "confident", "advanced"]);
const MAX_CORRECTIONS = 100;
const MAX_NOTE_LENGTH = 500;
const MAX_FIELD_LENGTH = 200;

/** Free-text note anchors the handoff adds (sensory / pacing context + the
 *  "Add context" / "Request changes" concern box). Recorded, never folded. */
const NOTE_ONLY_FIELDS = new Set(["sensory", "pacing", "concern"]);

/** Parse one submitted control value into a typed parent value, or null when
 *  the (field, value) pair is not a shape we record as a value change. */
function parseParentValue(field: string, raw: string): string | boolean | null {
  if (
    field.startsWith("accommodation.") ||
    field.startsWith("tutor.") ||
    field.startsWith("superpower.")
  ) {
    if (raw === "on") return true;
    if (raw === "off") return false;
    return null;
  }
  if (COMFORT_FIELDS.has(field)) {
    return COMFORT_VALUES.has(raw) ? raw : null;
  }
  return null;
}

function isCorrectableField(field: string): boolean {
  if (field.length === 0 || field.length > MAX_FIELD_LENGTH) return false;
  return (
    COMFORT_FIELDS.has(field) ||
    NOTE_ONLY_FIELDS.has(field) ||
    (field.startsWith("accommodation.") && field.length > "accommodation.".length) ||
    (field.startsWith("tutor.") && field.length > "tutor.".length) ||
    (field.startsWith("superpower.") && field.length > "superpower.".length)
  );
}

/** Build the parent modifications from the submitted native fields, deriving
 *  every `originalValue` from server-side state (never the client's word). */
function modificationsFromForm(
  formData: FormData,
  state: LearnerBrainProfileState,
): ParentModification[] {
  const values = new Map<string, string | boolean>();
  const notes = new Map<string, string>();
  for (const [key, entry] of formData.entries()) {
    if (typeof entry !== "string") continue;
    if (key.startsWith("value:")) {
      const field = key.slice("value:".length);
      if (!isCorrectableField(field)) continue;
      const parsed = parseParentValue(field, entry);
      if (parsed !== null) values.set(field, parsed);
    } else if (key.startsWith("note:")) {
      const field = key.slice("note:".length);
      if (!isCorrectableField(field)) continue;
      const note = entry.trim().slice(0, MAX_NOTE_LENGTH);
      if (note.length > 0) notes.set(field, note);
    }
  }

  const now = new Date().toISOString();
  const modifications: ParentModification[] = [];
  const fields = new Set<string>([...values.keys(), ...notes.keys()]);
  for (const field of fields) {
    const originalValue = originalValueForField(state, field);
    const parentValue = values.has(field) ? (values.get(field) as string | boolean) : originalValue;
    const parentNote = notes.get(field) ?? null;
    // Drop no-ops: same value, nothing to say.
    if (parentValue === originalValue && parentNote === null) continue;
    modifications.push({ field, originalValue, parentValue, parentNote, modifiedAt: now });
    if (modifications.length >= MAX_CORRECTIONS) break;
  }
  return modifications;
}

/** Shared gate: parent session + learner scope + a reviewable (cloned) profile. */
async function loadReviewable(learnerId: string) {
  const session = await requirePageRole(["parent"]);
  if (!learnerId) redirect("/parent/learners");
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    redirect("/parent/learners");
  }
  const profile = await getBrainProfile(learnerId, session.tenantId);
  if (!profile || profile.cloneStage !== "cloned") {
    // Not reviewable (not built yet, or already approved) — let the review
    // route re-render the right state for where things stand.
    redirect(`/parent/learners/${learnerId}/brain-review`);
  }
  return { session, profile };
}

/**
 * "Add context" / "Request changes" — stage the parent's corrections (removed
 * tags + note) without approving, so AIVO can revise before anything is
 * applied. Routes to the clone-watch recap, which owns the held state.
 */
export async function stageReviewAction(formData: FormData): Promise<void> {
  const learnerId = String(formData.get("learnerId") ?? "");
  const { session, profile } = await loadReviewable(learnerId);
  const modifications = modificationsFromForm(formData, profile.state);

  try {
    await stageBrainCorrections(learnerId, session.tenantId, modifications);
  } catch (err) {
    if (err instanceof BrainCorrectionLockedError) {
      audit(session, "brain_corrections.locked_rejected", newRequestId(), {
        learnerId,
        metadata: { lockedFields: err.lockedFields },
      });
      redirect(`/parent/learners/${learnerId}/brain-review?error=locked`);
    }
    logger.warn({
      event: "brain_corrections.stage_failed",
      learnerId,
      message: err instanceof Error ? err.message : String(err),
    });
    redirect(`/parent/learners/${learnerId}/brain-review?error=save`);
  }

  audit(session, "brain_corrections.stage", newRequestId(), {
    learnerId,
    metadata: { count: modifications.length, fields: modifications.map((m) => m.field) },
  });
  redirect(`/parent/learners/${learnerId}/brain-clone-watch`);
}

/**
 * "Approve & Create Virtual Brain" — stage any corrections the parent made,
 * then run the shared approval core (consent + RAI trust gate, fold, approval
 * record, contributor acknowledgements) and land on the celebration. The CTA is
 * disabled in the UI until consent + RAI are satisfied, but a forged POST that
 * omits either is still rejected inside `performBrainApproval`.
 */
export async function approveFromReviewAction(formData: FormData): Promise<void> {
  const learnerId = String(formData.get("learnerId") ?? "");
  const { session, profile } = await loadReviewable(learnerId);
  const modifications = modificationsFromForm(formData, profile.state);

  // Stage first so `performBrainApproval` → `approveBrainClone` folds them.
  if (modifications.length > 0) {
    try {
      await stageBrainCorrections(learnerId, session.tenantId, modifications);
    } catch (err) {
      if (err instanceof BrainCorrectionLockedError) {
        audit(session, "brain_corrections.locked_rejected", newRequestId(), {
          learnerId,
          metadata: { lockedFields: err.lockedFields },
        });
        redirect(`/parent/learners/${learnerId}/brain-review?error=locked`);
      }
      logger.warn({
        event: "brain_corrections.stage_failed",
        learnerId,
        message: err instanceof Error ? err.message : String(err),
      });
      redirect(`/parent/learners/${learnerId}/brain-review?error=save`);
    }
  }

  const result = await performBrainApproval({
    tenantId: session.tenantId,
    actorUserId: session.userId,
    learnerId,
    consentGiven: String(formData.get("consentGiven") ?? "") === "true",
    raiAcknowledged: String(formData.get("raiAcknowledged") ?? "") === "true",
    consentVersion: String(formData.get("consentVersion") ?? "") || BRAIN_CONSENT_VERSION,
    raiVersion: String(formData.get("raiVersion") ?? "") || null,
    ipHash: hashIpFromHeaders(await headers()),
  });

  if (!result.ok) {
    logger.warn({ event: "brain_profile.approve_rejected", learnerId, reason: result.reason });
    redirect(`/parent/learners/${learnerId}/brain-review?error=consent`);
  }

  audit(session, "brain_profile.approve", newRequestId(), {
    learnerId,
    metadata: {
      amended: result.profile.approvalStatus === "amended",
      approvalRecordId: result.record.id,
      profileRevision: result.record.profileRevision,
      consentVersion: result.record.consentVersion,
      raiVersion: result.record.raiVersion,
      surface: "brain_review",
    },
  });
  // Authoritative terminal reveal event (parity with the clone-watch ceremony),
  // recorded server-side so a forged client POST can't inflate the funnel.
  audit(
    session,
    revealAction(result.record.action === "amended" ? "amended" : "approved"),
    newRequestId(),
    { learnerId, metadata: { surface: "brain_review", approvalRecordId: result.record.id } },
  );
  redirect(`/parent/learners/${learnerId}/brain-clone-watch?celebrate=1`);
}
