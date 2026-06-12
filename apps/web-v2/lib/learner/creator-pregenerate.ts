/**
 * Remediation Sprint 06 — the Creator's pre-generation core.
 *
 * Sunday night (admin-svc `creator.weekly-generation`, a WeeklySchedule
 * SafeCron) calls web-v2's internal creator route, which runs this module:
 * for every learner in the requested tenants it pre-generates the NEXT
 * playable lesson as a `ready` LessonRun + persisted plan, so the learner's
 * week starts with zero generation latency. The mission picker already
 * resumes `ready` runs (`pickTodaysMission` step 1 → `today/start` returns
 * `resumed: true`), so pre-generated lessons are picked up with no player
 * changes.
 *
 * The generation itself is the REAL production path — `createLessonRun`
 * (brain-profile gate, mastery/accommodation snapshots, authored-pack
 * content, strict schema, persistence). This module only decides WHO and
 * WHAT FOR, mirroring the learning-path selection the learner home uses:
 * first un-completed path node by kind priority, where non-review nodes
 * skip already-completed skills.
 */
import { getPersistence } from "@/lib/db/persistence";
import { createLessonRun } from "@/lib/db/repos";
import type { LearningPathNode, LessonRun } from "@/lib/db/types";

/** Mirrors the learner home's mission ordering (lib/learner/today.ts). */
const KIND_PRIORITY: Record<LearningPathNode["kind"], number> = {
  first_skill: 1,
  review: 2,
  next_unmastered: 3,
  stretch: 4,
};

export interface PregenerateResult {
  scanned: number;
  generated: number;
  skippedExistingRun: number;
  skippedNoPath: number;
  skippedNotReady: number;
  failed: number;
  /** LessonRun ids created this pass (capped sample for the job log). */
  createdRunIds: string[];
}

/** Pick the learner's next learning-path target, or null when the path is
 *  exhausted/absent. Mirrors pickTodaysMission's path step. */
export async function pickNextPathTarget(
  learnerId: string,
  tenantId: string,
): Promise<LearningPathNode | null> {
  const persistence = getPersistence();
  const path = await persistence.curriculum.getLearningPath(learnerId, tenantId);
  if (!path || path.nodes.length === 0) return null;
  const runs = await persistence.lessonRuns.listForLearner(learnerId, tenantId, { limit: 200 });
  const completedRuns = runs.filter((r) => r.status === "completed");
  const completedNodeIds = new Set(
    completedRuns.map((r) => r.sourceRefId).filter((id): id is string => Boolean(id)),
  );
  const completedSkillIds = new Set(completedRuns.map((r) => r.skillId));
  const candidates = [...path.nodes].sort(
    (a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind] || a.order - b.order,
  );
  for (const node of candidates) {
    if (completedNodeIds.has(node.id)) continue;
    // Review nodes intentionally revisit completed skills; everything else
    // skips skills the learner already finished a run for.
    if (node.kind !== "review" && completedSkillIds.has(node.skillId)) continue;
    return node;
  }
  return null;
}

function hasOpenRun(runs: LessonRun[]): boolean {
  return runs.some((r) => r.status === "ready" || r.status === "in_progress");
}

/**
 * Pre-generate the next lesson for every learner in `tenantIds`. Idempotent:
 * learners with an open (`ready`/`in_progress`) run are skipped, so re-runs
 * never stack duplicate lessons. Each learner is isolated — one failure
 * never aborts the batch.
 */
export async function pregenerateNextLessons(input: {
  tenantIds: string[];
  /** Per-tenant learner cap per pass (safety valve). Default 500. */
  limitPerTenant?: number;
}): Promise<PregenerateResult> {
  const persistence = getPersistence();
  const limit = input.limitPerTenant ?? 500;
  const result: PregenerateResult = {
    scanned: 0,
    generated: 0,
    skippedExistingRun: 0,
    skippedNoPath: 0,
    skippedNotReady: 0,
    failed: 0,
    createdRunIds: [],
  };
  for (const tenantId of input.tenantIds) {
    const learners = (await persistence.learners.listForTenants([tenantId])).slice(0, limit);
    for (const learner of learners) {
      result.scanned += 1;
      try {
        const runs = await persistence.lessonRuns.listForLearner(learner.id, tenantId, {
          limit: 50,
        });
        if (hasOpenRun(runs)) {
          result.skippedExistingRun += 1;
          continue;
        }
        const target = await pickNextPathTarget(learner.id, tenantId);
        if (!target) {
          result.skippedNoPath += 1;
          continue;
        }
        const created = await createLessonRun({
          learnerId: learner.id,
          tenantId,
          subjectId: target.subjectId,
          skillId: target.skillId,
          source: "subject_path",
          sourceRefId: target.id,
        });
        if (created.ok) {
          result.generated += 1;
          if (result.createdRunIds.length < 25) result.createdRunIds.push(created.lessonRun.id);
        } else if (created.code === "brain_profile_missing") {
          // Not onboarded far enough for generation — expected for learners
          // who haven't completed the baseline; not a failure.
          result.skippedNotReady += 1;
        } else {
          result.failed += 1;
        }
      } catch {
        result.failed += 1;
      }
    }
  }
  return result;
}
