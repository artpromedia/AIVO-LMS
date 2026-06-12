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
import type { LearningPathNode } from "@/lib/db/types";

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

/** Sprint 07: per-week lesson budget per learner (one per enrolled subject,
 *  capped so a wide path can never fan out unboundedly). */
export const MAX_WEEK_LESSONS_PER_LEARNER = 5;

/**
 * Sprint 07 — enumerate the learner's COMING WEEK: one target per
 * learning-path subject (first eligible node per subject by the same
 * kind-priority/completion semantics the learner home uses), capped at
 * MAX_WEEK_LESSONS_PER_LEARNER.
 */
export async function enumerateWeekTargets(
  learnerId: string,
  tenantId: string,
): Promise<LearningPathNode[]> {
  const persistence = getPersistence();
  const path = await persistence.curriculum.getLearningPath(learnerId, tenantId);
  if (!path || path.nodes.length === 0) return [];
  const runs = await persistence.lessonRuns.listForLearner(learnerId, tenantId, { limit: 200 });
  const completedRuns = runs.filter((r) => r.status === "completed");
  const completedNodeIds = new Set(
    completedRuns.map((r) => r.sourceRefId).filter((id): id is string => Boolean(id)),
  );
  const completedSkillIds = new Set(completedRuns.map((r) => r.skillId));
  const candidates = [...path.nodes].sort(
    (a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind] || a.order - b.order,
  );
  const bySubject = new Map<string, LearningPathNode>();
  for (const node of candidates) {
    if (bySubject.has(node.subjectId)) continue;
    if (completedNodeIds.has(node.id)) continue;
    if (node.kind !== "review" && completedSkillIds.has(node.skillId)) continue;
    bySubject.set(node.subjectId, node);
    if (bySubject.size >= MAX_WEEK_LESSONS_PER_LEARNER) break;
  }
  return [...bySubject.values()];
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
          limit: 100,
        });
        // Sprint 07: the Creator prepares the WHOLE coming week — one lesson
        // per enrolled subject. Idempotency is per subject: a subject with an
        // open (ready/in_progress) run is skipped, so re-runs top the week
        // up without ever stacking duplicates.
        const openSubjectIds = new Set(
          runs
            .filter((r) => r.status === "ready" || r.status === "in_progress")
            .map((r) => r.subjectId),
        );
        const targets = (await enumerateWeekTargets(learner.id, tenantId)).filter(
          (t) => !openSubjectIds.has(t.subjectId),
        );
        if (targets.length === 0) {
          if (openSubjectIds.size > 0) result.skippedExistingRun += 1;
          else result.skippedNoPath += 1;
          continue;
        }
        let generatedForLearner = 0;
        for (const target of targets) {
          const created = await createLessonRun({
            learnerId: learner.id,
            tenantId,
            subjectId: target.subjectId,
            skillId: target.skillId,
            source: "weekly_creator",
            sourceRefId: target.id,
          });
          if (created.ok) {
            generatedForLearner += 1;
            result.generated += 1;
            if (result.createdRunIds.length < 25) result.createdRunIds.push(created.lessonRun.id);
          } else if (created.code === "brain_profile_missing") {
            // Not onboarded far enough for generation — expected for
            // learners who haven't completed the baseline; not a failure.
            result.skippedNotReady += 1;
            break;
          } else {
            result.failed += 1;
          }
        }
        if (generatedForLearner === 0 && openSubjectIds.size > 0) {
          result.skippedExistingRun += 1;
        }
      } catch {
        result.failed += 1;
      }
    }
  }
  return result;
}
