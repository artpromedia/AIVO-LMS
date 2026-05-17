/**
 * Recommendation effect handlers.
 *
 * When a parent approves (or amends-then-approves) a recommendation we must
 * apply the change to the learner's brain state. This module owns the
 * per-type effect logic. Each handler:
 *   1. Reads the latest brain_states row for the learner.
 *   2. Mutates the relevant field(s) using the recommendation payload.
 *   3. Writes the new state plus a brain_state_snapshots audit row.
 *
 * All effect handlers are pure with respect to the payload they're given:
 * the caller decides whether to pass the original payload, an amended
 * payload, or merged form — this module just applies it. Handlers run
 * inside the same db transaction as the status update so a failure
 * leaves the recommendation pending (and surfaces via apply_error).
 */
import { eq, desc } from "drizzle-orm";
import { brainStates, brainStateSnapshots } from "@aivo/db";

type DbLike = ReturnType<typeof import("@aivo/db").createDb>;

export interface EffectPayload {
  targetTable?: string;
  targetField?: string;
  currentValue?: unknown;
  proposedValue?: unknown;
  reason?: string;
  evidence?: Record<string, unknown>;
  confidence?: number;
  sourceSignals?: unknown[];
  requiresParentApproval?: boolean;
  // Domain-specific
  accommodation?: string;
  tutor?: string;
  domain?: string;
  level?: string;
  subject?: string;
  curriculumId?: string;
  [k: string]: unknown;
}

export interface EffectResult {
  applied: boolean;
  changedFields: string[];
  snapshotId?: string;
  message?: string;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through
    }
  }
  return {};
}

interface BrainStateRow {
  id: string;
  version: number | null;
  masteryLevels: unknown;
  activeAccommodations: unknown;
  activeTutors: unknown;
  functioningLevelProfile: unknown;
  curriculumAlignment: unknown;
  xaiExplanation: unknown;
}

async function loadBrainState(db: DbLike, learnerId: string): Promise<BrainStateRow | null> {
  const rows = await db
    .select()
    .from(brainStates)
    .where(eq(brainStates.learnerId, learnerId))
    .orderBy(desc(brainStates.version))
    .limit(1);
  return (rows[0] as BrainStateRow) || null;
}

async function writeSnapshot(
  db: DbLike,
  state: BrainStateRow,
  learnerId: string,
  newVersion: number,
  trigger: "parent_approved" | "parent_amended",
  recId: string,
  recType: string,
  payload: EffectPayload,
  patch: Record<string, unknown>
): Promise<string> {
  const snap = {
    masteryLevels: asObject(state.masteryLevels),
    activeAccommodations: asArray(state.activeAccommodations),
    activeTutors: asArray(state.activeTutors),
    functioningLevelProfile: asObject(state.functioningLevelProfile),
    curriculumAlignment: asObject(state.curriculumAlignment),
    ...patch,
    appliedFrom: {
      recommendationId: recId,
      recommendationType: recType,
      payload,
      trigger,
    },
  };
  const inserted = await db
    .insert(brainStateSnapshots)
    .values({
      brainStateId: state.id,
      learnerId,
      version: newVersion,
      trigger,
      snapshot: snap,
    })
    .returning({ id: brainStateSnapshots.id });
  return inserted[0]?.id ?? "";
}

export interface ApplyArgs {
  db: DbLike;
  learnerId: string;
  recId: string;
  recType: string;
  payload: EffectPayload;
  trigger: "parent_approved" | "parent_amended";
}

export async function applyRecommendationEffect(args: ApplyArgs): Promise<EffectResult> {
  const { db, learnerId, recType, payload, trigger, recId } = args;

  // brain_profile_review and brain_upgrade are pure status-only acknowledgements
  // (the brain-review workflow handles its own state mutations on /approve).
  if (recType === "brain_profile_review" || recType === "brain_upgrade") {
    return { applied: true, changedFields: [], message: "acknowledged" };
  }

  const state = await loadBrainState(db, learnerId);
  if (!state) {
    throw new Error("brain_state_missing");
  }
  const newVersion = (state.version ?? 1) + 1;

  switch (recType) {
    case "accommodation_add": {
      const accommodations = asArray(state.activeAccommodations);
      const name = String(payload.accommodation ?? payload.proposedValue ?? "").trim();
      if (!name) throw new Error("accommodation_name_missing");
      if (!accommodations.includes(name)) accommodations.push(name);
      await db
        .update(brainStates)
        .set({ activeAccommodations: accommodations, version: newVersion, updatedAt: new Date() })
        .where(eq(brainStates.id, state.id));
      const snapshotId = await writeSnapshot(db, state, learnerId, newVersion, trigger, recId, recType, payload, {
        activeAccommodations: accommodations,
      });
      return { applied: true, changedFields: ["active_accommodations"], snapshotId };
    }
    case "accommodation_remove": {
      const accommodations = asArray(state.activeAccommodations);
      const name = String(payload.accommodation ?? payload.currentValue ?? "").trim();
      if (!name) throw new Error("accommodation_name_missing");
      const next = accommodations.filter((a) => a !== name);
      await db
        .update(brainStates)
        .set({ activeAccommodations: next, version: newVersion, updatedAt: new Date() })
        .where(eq(brainStates.id, state.id));
      const snapshotId = await writeSnapshot(db, state, learnerId, newVersion, trigger, recId, recType, payload, {
        activeAccommodations: next,
      });
      return { applied: true, changedFields: ["active_accommodations"], snapshotId };
    }
    case "tutor_suggestion": {
      const tutors = asArray(state.activeTutors);
      const name = String(payload.tutor ?? payload.proposedValue ?? "").trim();
      if (!name) throw new Error("tutor_name_missing");
      if (!tutors.includes(name)) tutors.push(name);
      await db
        .update(brainStates)
        .set({ activeTutors: tutors, version: newVersion, updatedAt: new Date() })
        .where(eq(brainStates.id, state.id));
      const snapshotId = await writeSnapshot(db, state, learnerId, newVersion, trigger, recId, recType, payload, {
        activeTutors: tutors,
      });
      return { applied: true, changedFields: ["active_tutors"], snapshotId };
    }
    case "functioning_level_change": {
      const profile = asObject(state.functioningLevelProfile);
      const next = String(payload.level ?? payload.proposedValue ?? "").trim();
      if (!next) throw new Error("functioning_level_missing");
      const previousLevel = profile.level;
      profile.level = next;
      profile.lastChangedAt = new Date().toISOString();
      profile.lastChangeFrom = previousLevel ?? null;
      await db
        .update(brainStates)
        .set({ functioningLevelProfile: profile, version: newVersion, updatedAt: new Date() })
        .where(eq(brainStates.id, state.id));
      const snapshotId = await writeSnapshot(db, state, learnerId, newVersion, trigger, recId, recType, payload, {
        functioningLevelProfile: profile,
      });
      return { applied: true, changedFields: ["functioning_level_profile"], snapshotId };
    }
    case "curriculum_shift": {
      const alignment = asObject(state.curriculumAlignment);
      const subject = String(payload.subject ?? payload.domain ?? "general");
      alignment[subject] = {
        ...(asObject(alignment[subject])),
        curriculumId: payload.curriculumId ?? payload.proposedValue ?? null,
        previousCurriculumId: payload.currentValue ?? null,
        shiftedAt: new Date().toISOString(),
      };
      await db
        .update(brainStates)
        .set({ curriculumAlignment: alignment, version: newVersion, updatedAt: new Date() })
        .where(eq(brainStates.id, state.id));
      const snapshotId = await writeSnapshot(db, state, learnerId, newVersion, trigger, recId, recType, payload, {
        curriculumAlignment: alignment,
      });
      return { applied: true, changedFields: ["curriculum_alignment"], snapshotId };
    }
    case "path_adjustment": {
      // Path adjustments are stored alongside curriculum alignment so the
      // learning-path service can read them on next /path request. We don't
      // call learning-svc from here — the next path read will pick up the
      // new pathHints automatically.
      const alignment = asObject(state.curriculumAlignment);
      const subject = String(payload.subject ?? payload.domain ?? "general");
      const entry = asObject(alignment[subject]);
      const hints = asArray(entry.pathHints);
      hints.push({
        proposedValue: payload.proposedValue ?? null,
        reason: payload.reason ?? null,
        appliedAt: new Date().toISOString(),
      });
      entry.pathHints = hints;
      alignment[subject] = entry;
      await db
        .update(brainStates)
        .set({ curriculumAlignment: alignment, version: newVersion, updatedAt: new Date() })
        .where(eq(brainStates.id, state.id));
      const snapshotId = await writeSnapshot(db, state, learnerId, newVersion, trigger, recId, recType, payload, {
        curriculumAlignment: alignment,
      });
      return { applied: true, changedFields: ["curriculum_alignment"], snapshotId };
    }
    case "rebaseline": {
      // Flag the brain state so the next baseline endpoint unlocks. We don't
      // create the assessment row here (that's owned by assessment-svc); we
      // just record the request in the functioning-level profile.
      const profile = asObject(state.functioningLevelProfile);
      const requests = asArray(profile.rebaselineRequests);
      requests.push({
        requestedAt: new Date().toISOString(),
        recommendationId: recId,
        reason: payload.reason ?? null,
      });
      profile.rebaselineRequests = requests;
      profile.rebaselinePending = true;
      await db
        .update(brainStates)
        .set({ functioningLevelProfile: profile, version: newVersion, updatedAt: new Date() })
        .where(eq(brainStates.id, state.id));
      const snapshotId = await writeSnapshot(db, state, learnerId, newVersion, trigger, recId, recType, payload, {
        functioningLevelProfile: profile,
      });
      return { applied: true, changedFields: ["functioning_level_profile"], snapshotId };
    }
    case "regression_alert":
    case "goal_suggestion":
    case "iep_goal_met":
    case "iep_refresh": {
      // These flow into XAI explanation as advisory notes — they do not
      // mutate mastery/accommodations directly. They are still resolved
      // so the parent acknowledgement is recorded.
      const xai = asObject(state.xaiExplanation);
      const advisories = asArray(xai.advisories);
      advisories.push({
        type: recType,
        recommendationId: recId,
        payload,
        appliedAt: new Date().toISOString(),
      });
      xai.advisories = advisories;
      await db
        .update(brainStates)
        .set({ xaiExplanation: xai, version: newVersion, updatedAt: new Date() })
        .where(eq(brainStates.id, state.id));
      const snapshotId = await writeSnapshot(db, state, learnerId, newVersion, trigger, recId, recType, payload, {
        xaiExplanation: xai,
      });
      return { applied: true, changedFields: ["xai_explanation"], snapshotId };
    }
    default:
      throw new Error(`unknown_recommendation_type:${recType}`);
  }
}
