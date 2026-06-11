/**
 * Drizzle-backed CurriculumStore. Subjects/skills are reference data;
 * masteryMaps/skillMasteries/learningPaths/reviewSchedules are per-learner.
 * Mirrors the memory store, including the delete-prior-then-insert sequences
 * in replaceLearningPath / replaceSkillMasteriesForSubjects /
 * replaceReviewSchedules (each wrapped in a transaction so a failed insert
 * can't leave the learner with no rows).
 *
 * SkillMastery rows have no domain id (keyed by learner+tenant+skill), so the
 * adapter derives a deterministic surrogate PK; upserts delete any prior row
 * for the same key first, which also heals legacy rows that were seeded with
 * random surrogate ids.
 */
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  webSubjects,
  webSkills,
  webMasteryMaps,
  webSkillMasteries,
  webLearningPaths,
  webReviewSchedules,
  webMasterySnapshots,
} from "@aivo/db";
import type {
  LearningPath,
  MasteryMap,
  MasterySnapshot,
  ReviewSchedule,
  Skill,
  SkillMastery,
  Subject,
} from "@/lib/db/types";
import type { CurriculumStore } from "../types";
import { getDb } from "./client";

/** Deterministic surrogate PK for a (learner, tenant, skill) mastery row. */
function skillMasteryRowId(row: Pick<SkillMastery, "learnerId" | "tenantId" | "skillId">): string {
  return `sm:${row.tenantId}:${row.learnerId}:${row.skillId}`;
}

export const drizzleCurriculum: CurriculumStore = {
  async listSubjects() {
    const rows = await getDb().select().from(webSubjects);
    return rows.map((r) => r.data as Subject);
  },

  async getSubjectById(subjectId) {
    const [row] = await getDb()
      .select()
      .from(webSubjects)
      .where(eq(webSubjects.id, subjectId))
      .limit(1);
    return row ? (row.data as Subject) : null;
  },

  async listSkills(subjectId) {
    const db = getDb();
    const rows = subjectId
      ? await db.select().from(webSkills).where(eq(webSkills.subjectId, subjectId))
      : await db.select().from(webSkills);
    return rows.map((r) => r.data as Skill);
  },

  async getSkillById(skillId) {
    const [row] = await getDb().select().from(webSkills).where(eq(webSkills.id, skillId)).limit(1);
    return row ? (row.data as Skill) : null;
  },

  async upsertSkill(skill) {
    await getDb()
      .insert(webSkills)
      .values({ id: skill.id, subjectId: skill.subjectId ?? null, data: skill })
      .onConflictDoUpdate({
        target: webSkills.id,
        set: { subjectId: skill.subjectId ?? null, data: skill },
      });
    return skill;
  },

  async getMasteryMapForLearner(learnerId, tenantId) {
    const db = getDb();
    const [mapRow] = await db
      .select()
      .from(webMasteryMaps)
      .where(and(eq(webMasteryMaps.learnerId, learnerId), eq(webMasteryMaps.tenantId, tenantId)))
      .limit(1);
    const masteryRows = await db
      .select()
      .from(webSkillMasteries)
      .where(
        and(eq(webSkillMasteries.learnerId, learnerId), eq(webSkillMasteries.tenantId, tenantId)),
      );
    return {
      map: mapRow ? (mapRow.data as MasteryMap) : null,
      skillMasteries: masteryRows.map((r) => r.data as SkillMastery),
    };
  },

  async upsertMasteryMap(map) {
    await getDb()
      .insert(webMasteryMaps)
      .values({ id: map.id, learnerId: map.learnerId, tenantId: map.tenantId, data: map })
      .onConflictDoUpdate({
        target: webMasteryMaps.id,
        set: { learnerId: map.learnerId, tenantId: map.tenantId, data: map },
      });
    return map;
  },

  async replaceSkillMasteriesForSubjects(learnerId, tenantId, subjectIds, rows) {
    await getDb().transaction(async (tx) => {
      if (subjectIds.length > 0) {
        await tx
          .delete(webSkillMasteries)
          .where(
            and(
              eq(webSkillMasteries.learnerId, learnerId),
              eq(webSkillMasteries.tenantId, tenantId),
              inArray(sql`${webSkillMasteries.data}->>'subjectId'`, subjectIds),
            ),
          );
      }
      if (rows.length > 0) {
        await tx.insert(webSkillMasteries).values(
          rows.map((m) => ({
            id: skillMasteryRowId(m),
            learnerId: m.learnerId,
            tenantId: m.tenantId,
            data: m,
          })),
        );
      }
    });
  },

  async upsertSkillMastery(row) {
    // Delete-then-insert (not ON CONFLICT) so a legacy row for the same
    // (learner, tenant, skill) key under a random surrogate id is replaced
    // rather than duplicated.
    await getDb().transaction(async (tx) => {
      await tx
        .delete(webSkillMasteries)
        .where(
          and(
            eq(webSkillMasteries.learnerId, row.learnerId),
            eq(webSkillMasteries.tenantId, row.tenantId),
            eq(sql`${webSkillMasteries.data}->>'skillId'`, row.skillId),
          ),
        );
      await tx.insert(webSkillMasteries).values({
        id: skillMasteryRowId(row),
        learnerId: row.learnerId,
        tenantId: row.tenantId,
        data: row,
      });
    });
    return row;
  },

  async getLearningPath(learnerId, tenantId) {
    const [row] = await getDb()
      .select()
      .from(webLearningPaths)
      .where(
        and(eq(webLearningPaths.learnerId, learnerId), eq(webLearningPaths.tenantId, tenantId)),
      )
      .limit(1);
    return row ? (row.data as LearningPath) : null;
  },

  async replaceLearningPath(learnerId, tenantId, next) {
    const db = getDb();
    await db
      .delete(webLearningPaths)
      .where(
        and(eq(webLearningPaths.learnerId, learnerId), eq(webLearningPaths.tenantId, tenantId)),
      );
    await db
      .insert(webLearningPaths)
      .values({ id: next.id, learnerId, tenantId, data: next })
      .onConflictDoUpdate({
        target: webLearningPaths.id,
        set: { learnerId, tenantId, data: next },
      });
    return next;
  },

  async appendMasterySnapshot(row) {
    await getDb().insert(webMasterySnapshots).values({
      id: row.id,
      learnerId: row.learnerId,
      tenantId: row.tenantId,
      subjectId: row.subjectId,
      capturedAt: row.capturedAt,
      data: row,
    });
    return row;
  },

  async listMasterySnapshots(learnerId, tenantId, opts) {
    const conditions = [
      eq(webMasterySnapshots.learnerId, learnerId),
      eq(webMasterySnapshots.tenantId, tenantId),
    ];
    if (opts?.subjectId) conditions.push(eq(webMasterySnapshots.subjectId, opts.subjectId));
    if (opts?.sinceIso) conditions.push(gte(webMasterySnapshots.capturedAt, opts.sinceIso));
    const rows = await getDb()
      .select()
      .from(webMasterySnapshots)
      .where(and(...conditions))
      .orderBy(asc(webMasterySnapshots.capturedAt));
    return rows.map((r) => r.data as MasterySnapshot);
  },

  async getReviewSchedules(learnerId, tenantId) {
    const rows = await getDb()
      .select()
      .from(webReviewSchedules)
      .where(
        and(eq(webReviewSchedules.learnerId, learnerId), eq(webReviewSchedules.tenantId, tenantId)),
      );
    return rows.map((r) => r.data as ReviewSchedule);
  },

  async replaceReviewSchedules(learnerId, tenantId, rows) {
    await getDb().transaction(async (tx) => {
      await tx
        .delete(webReviewSchedules)
        .where(
          and(
            eq(webReviewSchedules.learnerId, learnerId),
            eq(webReviewSchedules.tenantId, tenantId),
          ),
        );
      if (rows.length > 0) {
        await tx.insert(webReviewSchedules).values(
          rows.map((r) => ({ id: r.id, learnerId: r.learnerId, tenantId: r.tenantId, data: r })),
        );
      }
    });
  },
};
