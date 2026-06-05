/**
 * In-memory LearnerStore — wraps the existing learnerProfiles Map +
 * parentLearnerRelationships array + classrooms / enrollments Maps.
 *
 * Selected when AIVO_PERSISTENCE_LEARNERS=memory (default). Preserves
 * the legacy semantics exactly: same insertion order for relationships,
 * same isPrimary inference (first relationship for a parent is
 * primary), same cascade behaviour on delete (relationships + parent
 * assessments).
 */
import { getStore, newId, nowIso } from "@/lib/db/store";
import type { LearnerProfile, ParentLearnerRelationship, ReadinessState } from "@/lib/db/types";
import type { LearnerStore } from "../types";
import type { CreateLearnerInput, PatchLearnerInput } from "@/lib/validators/learner";

const DEFAULT_ACCESSIBILITY = {
  reducedMotion: false,
  highContrast: false,
  largeText: false,
  audioFirst: false,
  captionsAlwaysOn: false,
};

export const memoryLearners: LearnerStore = {
  async getById(id, tenantId) {
    const learner = getStore().learnerProfiles.get(id);
    if (!learner || learner.tenantId !== tenantId) return null;
    return learner;
  },

  async listForParent(parentUserId, tenantId) {
    const store = getStore();
    const learnerIds = new Set(
      store.parentLearnerRelationships
        .filter((r) => r.parentUserId === parentUserId && r.tenantId === tenantId)
        .map((r) => r.learnerId),
    );
    return Array.from(store.learnerProfiles.values()).filter(
      (l) => l.tenantId === tenantId && learnerIds.has(l.id),
    );
  },

  async listForTeacher(teacherUserId, tenantId) {
    const store = getStore();
    const classroomIds = new Set(
      Array.from(store.classrooms.values())
        .filter((c) => c.tenantId === tenantId && c.teacherUserId === teacherUserId)
        .map((c) => c.id),
    );
    for (const e of store.enrollments.values()) {
      if (e.tenantId === tenantId && e.role === "teacher" && e.subjectId === teacherUserId) {
        classroomIds.add(e.classroomId);
      }
    }
    if (classroomIds.size === 0) return [];
    const learnerIds = new Set<string>();
    for (const e of store.enrollments.values()) {
      if (e.tenantId === tenantId && e.role === "learner" && classroomIds.has(e.classroomId)) {
        learnerIds.add(e.subjectId);
      }
    }
    return Array.from(store.learnerProfiles.values()).filter(
      (l) => l.tenantId === tenantId && learnerIds.has(l.id),
    );
  },

  async listForTenants(tenantIds) {
    const ids = new Set(tenantIds);
    return Array.from(getStore().learnerProfiles.values()).filter((l) => ids.has(l.tenantId));
  },

  async parentCanAccess(parentUserId, learnerId, tenantId) {
    return getStore().parentLearnerRelationships.some(
      (r) =>
        r.parentUserId === parentUserId && r.learnerId === learnerId && r.tenantId === tenantId,
    );
  },

  async teacherCanAccess(teacherUserId, learnerId, tenantId) {
    const learners = await memoryLearners.listForTeacher(teacherUserId, tenantId);
    return learners.some((l) => l.id === learnerId);
  },

  async findPrimaryParent(learnerId, tenantId) {
    const rels = getStore().parentLearnerRelationships.filter(
      (r) => r.learnerId === learnerId && r.tenantId === tenantId,
    );
    if (!rels.length) return null;
    return (rels.find((r) => r.isPrimary) ?? rels[0]!).parentUserId;
  },

  async create({ tenantId, parentUserId, data }) {
    const store = getStore();
    const id = newId("lrn");
    const d: CreateLearnerInput = data;
    const display = d.preferredName?.trim() || d.firstName.trim();
    const learner: LearnerProfile = {
      id,
      tenantId,
      displayName: display,
      firstName: d.firstName.trim(),
      preferredName: d.preferredName?.trim() || null,
      birthYear: d.birthYear,
      pronouns: d.pronouns ?? undefined,
      ageRange: d.ageRange ?? null,
      gradeBand: d.gradeBand ?? null,
      schoolContext: d.schoolContext ?? null,
      primaryLanguage: d.primaryLanguage ?? null,
      readingComfort: d.readingComfort ?? null,
      mathComfort: d.mathComfort ?? null,
      knownStrengths: d.knownStrengths ?? [],
      knownChallenges: d.knownChallenges ?? [],
      accessibilityDefaults: { ...DEFAULT_ACCESSIBILITY, ...(d.accessibilityDefaults ?? {}) },
      zipCode: d.zipCode ?? null,
      districtId: d.districtId ?? null,
      districtName: d.districtName ?? null,
      functioningLevel: null,
      readinessState: "profile_created",
      iepDecision: null,
      createdAt: nowIso(),
    };
    store.learnerProfiles.set(id, learner);
    const rel: ParentLearnerRelationship = {
      id: newId("plr"),
      parentUserId,
      learnerId: id,
      tenantId,
      relation: "parent",
      isPrimary: store.parentLearnerRelationships.every((r) => r.parentUserId !== parentUserId),
    };
    store.parentLearnerRelationships.push(rel);
    return learner;
  },

  async update(id, tenantId, patch) {
    const store = getStore();
    const existing = store.learnerProfiles.get(id);
    if (!existing || existing.tenantId !== tenantId) return null;
    const p: PatchLearnerInput = patch;
    const next: LearnerProfile = {
      ...existing,
      firstName: p.firstName ?? existing.firstName,
      preferredName:
        p.preferredName === undefined ? existing.preferredName : p.preferredName?.trim() || null,
      birthYear: p.birthYear ?? existing.birthYear,
      pronouns: p.pronouns === undefined ? existing.pronouns : (p.pronouns ?? undefined),
      ageRange: p.ageRange === undefined ? existing.ageRange : (p.ageRange ?? null),
      gradeBand: p.gradeBand === undefined ? existing.gradeBand : (p.gradeBand ?? null),
      schoolContext:
        p.schoolContext === undefined ? existing.schoolContext : (p.schoolContext ?? null),
      primaryLanguage:
        p.primaryLanguage === undefined ? existing.primaryLanguage : (p.primaryLanguage ?? null),
      readingComfort:
        p.readingComfort === undefined ? existing.readingComfort : (p.readingComfort ?? null),
      mathComfort: p.mathComfort === undefined ? existing.mathComfort : (p.mathComfort ?? null),
      knownStrengths: p.knownStrengths ?? existing.knownStrengths,
      knownChallenges: p.knownChallenges ?? existing.knownChallenges,
      accessibilityDefaults: p.accessibilityDefaults
        ? { ...existing.accessibilityDefaults, ...p.accessibilityDefaults }
        : existing.accessibilityDefaults,
      zipCode: p.zipCode === undefined ? existing.zipCode : (p.zipCode ?? null),
      districtId: p.districtId === undefined ? existing.districtId : (p.districtId ?? null),
      districtName: p.districtName === undefined ? existing.districtName : (p.districtName ?? null),
    };
    next.displayName = next.preferredName?.trim() || next.firstName.trim();
    store.learnerProfiles.set(id, next);
    return next;
  },

  async delete(id, tenantId) {
    const store = getStore();
    const existing = store.learnerProfiles.get(id);
    if (!existing || existing.tenantId !== tenantId) return false;
    store.learnerProfiles.delete(id);
    store.parentLearnerRelationships = store.parentLearnerRelationships.filter(
      (r) => r.learnerId !== id,
    );
    for (const [aid, a] of store.parentAssessments) {
      if (a.learnerId === id) store.parentAssessments.delete(aid);
    }
    return true;
  },

  async setReadinessState(id, tenantId, state: ReadinessState) {
    const store = getStore();
    const existing = store.learnerProfiles.get(id);
    if (!existing || existing.tenantId !== tenantId) return null;
    if (state === existing.readinessState) return existing;
    const next: LearnerProfile = { ...existing, readinessState: state };
    store.learnerProfiles.set(id, next);
    return next;
  },

  async getAccessibility(id, tenantId) {
    const existing = getStore().learnerProfiles.get(id);
    if (!existing || existing.tenantId !== tenantId) return null;
    return existing.accessibilityPreferences ?? null;
  },

  async setAccessibility(id, tenantId, prefs) {
    const store = getStore();
    const existing = store.learnerProfiles.get(id);
    if (!existing || existing.tenantId !== tenantId) return null;
    const next: LearnerProfile = { ...existing, accessibilityPreferences: prefs ?? undefined };
    store.learnerProfiles.set(id, next);
    return next.accessibilityPreferences ?? null;
  },
};
