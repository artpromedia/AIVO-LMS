/**
 * Drizzle-backed CurriculumStore. Subjects/skills are reference data;
 * masteryMaps/skillMasteries/learningPaths are per-learner. Mirrors the
 * memory store, including the delete-prior-then-insert sequence in
 * replaceLearningPath.
 */
import { and, eq } from "drizzle-orm";
import {
  webSubjects,
  webSkills,
  webMasteryMaps,
  webSkillMasteries,
  webLearningPaths,
} from "@aivo/db";
import type { LearningPath, MasteryMap, Skill, SkillMastery, Subject } from "@/lib/db/types";
import type { CurriculumStore } from "../types";
import { getDb } from "./client";

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
};
