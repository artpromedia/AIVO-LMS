"use server";

/**
 * Sprint C-05 — review-screen server action: stage the parent's corrections.
 *
 * The review form submits NATIVE fields (`value:<field>` radios and
 * `note:<field>` textareas — the assessment primitives are native-form
 * compatible by design), so corrections survive without any client JS. The
 * action:
 *
 *   1. derives `originalValue` from the CURRENT server-side state (never the
 *      client's word — see `originalValueForField`),
 *   2. drops no-ops (value unchanged and no note),
 *   3. stages the rest server-side via `stageBrainCorrections` (resume state
 *      lives in the profile record, not in component state), and
 *   4. routes onward to the approval recap, which folds the staged
 *      corrections when the parent approves.
 *
 * Therapist-pinned supports are rejected server-side by the repo layer
 * (`BrainCorrectionLockedError`) — the disabled row in the UI is a courtesy,
 * not the defense.
 */
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { getBrainProfile, parentCanAccessLearner, stageBrainCorrections } from "@/lib/db/repos";
import {
  BrainCorrectionLockedError,
  originalValueForField,
} from "@/lib/db/brain-corrections";
import type { LearnerBrainProfile, ParentModification } from "@/lib/db/types";
import { audit } from "@/lib/bff/audit";
import { newRequestId, logger } from "@/lib/observability/logger";

export type SaveCorrectionsState = {
  error: "save_failed" | "locked" | null;
};

const COMFORT_FIELDS = new Set(["readingComfort", "mathComfort"]);
const COMFORT_VALUES = new Set(["new", "growing", "confident", "advanced"]);
const MAX_CORRECTIONS = 100;
const MAX_NOTE_LENGTH = 500;
const MAX_FIELD_LENGTH = 200;

/** Parse one submitted control value into a typed parent value, or null when
 *  the (field, value) pair is not a shape the correction contract folds. */
function parseParentValue(field: string, raw: string): string | boolean | null {
  if (field.startsWith("accommodation.") || field.startsWith("tutor.")) {
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
    (field.startsWith("accommodation.") && field.length > "accommodation.".length) ||
    (field.startsWith("tutor.") && field.length > "tutor.".length)
  );
}

export async function saveBrainCorrectionsAction(
  _prev: SaveCorrectionsState,
  formData: FormData,
): Promise<SaveCorrectionsState> {
  const session = await requirePageRole(["parent"]);
  const learnerId = String(formData.get("learnerId") ?? "");
  if (!learnerId) return { error: "save_failed" };
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    redirect("/parent/learners");
  }
  const profile = await getBrainProfile(learnerId, session.tenantId);
  if (!profile || profile.cloneStage !== "cloned") {
    // Nothing reviewable (not built yet, or already approved) — re-render
    // the review route, which shows the right state for where things stand.
    redirect(`/parent/learners/${learnerId}/brain-review`);
  }

  // Gather the submitted controls. Values and notes are keyed by the
  // correction field; a note without a value change is a legitimate
  // "keep it, but here's context" correction (parentValue === originalValue).
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
    const originalValue = originalValueForField(profile.state, field);
    const parentValue = values.has(field) ? (values.get(field) as string | boolean) : originalValue;
    const parentNote = notes.get(field) ?? null;
    // Drop no-ops: same value, nothing to say.
    if (parentValue === originalValue && parentNote === null) continue;
    modifications.push({ field, originalValue, parentValue, parentNote, modifiedAt: now });
    if (modifications.length >= MAX_CORRECTIONS) break;
  }

  let staged: LearnerBrainProfile | null = null;
  try {
    staged = await stageBrainCorrections(learnerId, session.tenantId, modifications);
  } catch (err) {
    if (err instanceof BrainCorrectionLockedError) {
      // Forged unlock of a therapist-pinned support — rejected server-side.
      audit(session, "brain_corrections.locked_rejected", newRequestId(), {
        learnerId,
        metadata: { lockedFields: err.lockedFields },
      });
      return { error: "locked" };
    }
    logger.warn({
      event: "brain_corrections.stage_failed",
      learnerId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { error: "save_failed" };
  }
  if (!staged) {
    // The profile moved on while the form was open (e.g. approved in another
    // tab). Re-render the review route to show the current state.
    redirect(`/parent/learners/${learnerId}/brain-review`);
  }

  audit(session, "brain_corrections.stage", newRequestId(), {
    learnerId,
    metadata: { count: modifications.length, fields: modifications.map((m) => m.field) },
  });
  redirect(`/parent/learners/${learnerId}/brain-clone-watch`);
}
