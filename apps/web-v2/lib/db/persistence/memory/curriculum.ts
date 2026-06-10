/**
 * In-memory CurriculumStore — wraps subjects / skills / masteryMaps /
 * skillMasteries / learningPaths / reviewSchedules from the legacy Map store.
 *
 * Subjects + skills are effectively immutable post-seed; mastery rows,
 * learning paths, and review schedules are per-learner mutable.
 * `replaceLearningPath` / `replaceSkillMasteriesForSubjects` /
 * `replaceReviewSchedules` encapsulate the delete-prior + insert-next
 * sequences so callers don't have to coordinate the writes.
 */
import { getStore } from "@/lib/db/store";
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

  async upsertMasteryMap(map: MasteryMap) {
    getStore().masteryMaps.set(map.id, map);
    return map;
  },

  async replaceSkillMasteriesForSubjects(
    learnerId,
    tenantId,
    subjectIds,
    rows: SkillMastery[],
  ) {
    const store = getStore();
    const covered = new Set(subjectIds);
    store.skillMasteries = store.skillMasteries.filter(
      (m) => !(m.learnerId === learnerId && m.tenantId === tenantId && covered.has(m.subjectId)),
    );
    store.skillMasteries.push(...rows);
  },

  async upsertSkillMastery(row: SkillMastery) {
    const store = getStore();
    const existing = store.skillMasteries.find(
      (m) =>
        m.learnerId === row.learnerId && m.tenantId === row.tenantId && m.skillId === row.skillId,
    );
    if (existing) {
      Object.assign(existing, row);
      return existing;
    }
    store.skillMasteries.push(row);
    return row;
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

  async appendMasterySnapshot(row: MasterySnapshot) {
    getStore().masterySnapshots.push(row);
    return row;
  },

  async listMasterySnapshots(learnerId, tenantId, opts) {
    return getStore()
      .masterySnapshots.filter(
        (m) =>
          m.learnerId === learnerId &&
          m.tenantId === tenantId &&
          (!opts?.subjectId || m.subjectId === opts.subjectId) &&
          (!opts?.sinceIso || m.capturedAt >= opts.sinceIso),
      )
      .slice()
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  },

  async getReviewSchedules(learnerId, tenantId) {
    return getStore().reviewSchedules.filter(
      (r) => r.learnerId === learnerId && r.tenantId === tenantId,
    );
  },

  async replaceReviewSchedules(learnerId, tenantId, rows: ReviewSchedule[]) {
    const store = getStore();
    store.reviewSchedules = store.reviewSchedules.filter(
      (r) => !(r.learnerId === learnerId && r.tenantId === tenantId),
    );
    store.reviewSchedules.push(...rows);
  },
};
