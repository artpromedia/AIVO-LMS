/**
 * Thin client for family-svc. The visibility policy needs three queries:
 *
 *   - getParentLearners(parentUserId) – which learners can this parent see
 *   - getCaregiverLearners(caregiverUserId) – read-only caregiver scope
 *   - getTeacherLearners(teacherUserId) – which learners is this teacher
 *     a teacher of
 *
 * These all return string[] of learner_ids. We keep the surface to ID
 * lists so the policy file stays a pure-ish function (no nested types
 * leaking from family-svc's data model).
 */
export interface FamilyRelationships {
  parentLearnerIds: string[];
  caregiverLearnerIds: string[];
  teacherLearnerIds: string[];
  therapistLearnerIds: string[];
}

export interface FamilyClient {
  getRelationships(userId: string): Promise<FamilyRelationships>;
  // Lesson-scoped channel needs to know "is this learner in this teacher's
  // active lesson right now". Returns true only while the lesson is open.
  isLessonActiveForPair(learnerId: string, teacherId: string, lessonId: string): Promise<boolean>;
}

export function createFamilyClient(opts?: {
  baseUrl?: string;
  internalKey?: string;
  fetchImpl?: typeof fetch;
}): FamilyClient {
  const baseUrl = opts?.baseUrl ?? process.env.FAMILY_SVC_URL ?? "http://localhost:3007";
  const internalKey =
    opts?.internalKey ??
    process.env.INTERNAL_SERVICE_KEY ??
    (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
  const fetchImpl = opts?.fetchImpl ?? fetch;

  const headers = (): Record<string, string> => ({
    "content-type": "application/json",
    "x-internal-key": internalKey,
  });

  const empty: FamilyRelationships = {
    parentLearnerIds: [],
    caregiverLearnerIds: [],
    teacherLearnerIds: [],
    therapistLearnerIds: [],
  };

  return {
    async getRelationships(userId) {
      try {
        const res = await fetchImpl(
          `${baseUrl}/api/family/internal/relationships/${encodeURIComponent(userId)}`,
          { headers: headers() },
        );
        if (!res.ok) return empty;
        const payload = (await res.json()) as Partial<FamilyRelationships>;
        return {
          parentLearnerIds: payload.parentLearnerIds ?? [],
          caregiverLearnerIds: payload.caregiverLearnerIds ?? [],
          teacherLearnerIds: payload.teacherLearnerIds ?? [],
          therapistLearnerIds: payload.therapistLearnerIds ?? [],
        };
      } catch {
        return empty;
      }
    },
    async isLessonActiveForPair(learnerId, teacherId, lessonId) {
      try {
        const url = new URL(`${baseUrl}/api/family/internal/lesson-active`);
        url.searchParams.set("learnerId", learnerId);
        url.searchParams.set("teacherId", teacherId);
        url.searchParams.set("lessonId", lessonId);
        const res = await fetchImpl(url.toString(), { headers: headers() });
        if (!res.ok) return false;
        const body = (await res.json()) as { active?: boolean };
        return body.active === true;
      } catch {
        return false;
      }
    },
  };
}
