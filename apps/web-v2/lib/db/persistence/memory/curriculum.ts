/**
 * In-memory CurriculumStore — wraps subjects / skills / masteryMaps /
 * skillMasteries / learningPaths from the legacy Map store.
 *
 * Subjects + skills are effectively immutable post-seed; mastery rows
 * and learning paths are per-learner mutable. `replaceLearningPath`
 * encapsulates the delete-prior + insert-next sequence so callers
 * don't have to coordinate the two writes.
 */
import { getStore } from "@/lib/db/store";
import type { LearningPath, MasteryMap, Skill, SkillMastery, Subject } from "@/lib/db/types";
import type { CurriculumStore } from "../types";

export const memoryCurriculum: CurriculumStore = {
  async listSubjects(): Promise<Subject[]> {
    return Array.from(getStore().subjects.values());
  },

  async getSubjectById(subjectId) {
    return getStore().subjects.get(subjectId) ?? null;
  },

  async listSkills(subjectId): Promise<Skill[]> {
    const all = Array.from(getStore().skills.values());
    return subjectId ? all.filter((s) => s.subjectId === subjectId) : all;
  },

  async getSkillById(skillId) {
    return getStore().skills.get(skillId) ?? null;
  },

  async upsertSkill(skill) {
    getStore().skills.set(skill.id, skill);
    return skill;
  },

  async getMasteryMapForLearner(learnerId, tenantId) {
    const store = getStore();
    let map: MasteryMap | null = null;
    for (const m of store.masteryMaps.values()) {
      if (m.learnerId === learnerId && m.tenantId === tenantId) {
        map = m;
        break;
      }
    }
    const skillMasteries: SkillMastery[] = store.skillMasteries.filter(
      (s) => s.learnerId === learnerId && s.tenantId === tenantId,
    );
    return { map, skillMasteries };
  },

  async getLearningPath(learnerId, tenantId) {
    for (const p of getStore().learningPaths.values()) {
      if (p.learnerId === learnerId && p.tenantId === tenantId) return p;
    }
    return null;
  },

  async replaceLearningPath(learnerId, tenantId, next: LearningPath) {
    const store = getStore();
    for (const [id, p] of store.learningPaths) {
      if (p.learnerId === learnerId && p.tenantId === tenantId) {
        store.learningPaths.delete(id);
      }
    }
    store.learningPaths.set(next.id, next);
    return next;
  },
};
