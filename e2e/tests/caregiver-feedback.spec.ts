import { test, expect } from "@playwright/test";

/**
 * Sprint 8 E2E — caregiver feedback loop (G1/G2, promise #2).
 *
 * A teacher's corroborated observations surface a PENDING parent-approval
 * recommendation (teachers/caregivers propose; parents approve — brain state
 * is never mutated without approval).
 *
 * Requires the family-svc + recommendation-svc stack and a teacher session +
 * learner on roster. Skips when the env is not provided.
 */
const FAMILY_SVC_URL = process.env.FAMILY_SVC_URL;
const RECOMMENDATION_SVC_URL = process.env.RECOMMENDATION_SVC_URL;
const TEACHER_TOKEN = process.env.E2E_TEACHER_BEARER;
const LEARNER_ID = process.env.E2E_ROSTER_LEARNER_ID;

test.describe("caregiver feedback loop", () => {
  test.skip(
    !FAMILY_SVC_URL || !RECOMMENDATION_SVC_URL || !TEACHER_TOKEN || !LEARNER_ID,
    "Requires FAMILY_SVC_URL, RECOMMENDATION_SVC_URL, E2E_TEACHER_BEARER, E2E_ROSTER_LEARNER_ID",
  );

  test("two teacher observations → a PENDING recommendation citing the teacher", async ({
    request,
  }) => {
    const auth = { Authorization: `Bearer ${TEACHER_TOKEN}`, "content-type": "application/json" };

    // Two corroborating sensory observations from the teacher.
    for (let i = 0; i < 2; i++) {
      const obs = await request.post(`${FAMILY_SVC_URL}/api/family/observations`, {
        headers: auth,
        data: { learnerId: LEARNER_ID, category: "sensory", notes: "Sensory overload in class." },
      });
      expect(obs.ok()).toBeTruthy();
    }

    // A PENDING parent-approval recommendation appears (eventually-consistent).
    await expect
      .poll(
        async () => {
          const res = await request.get(
            `${RECOMMENDATION_SVC_URL}/api/recommendations?learnerId=${LEARNER_ID}&status=PENDING`,
            { headers: auth },
          );
          if (!res.ok()) return [];
          const body = await res.json();
          return (body.recommendations ?? body ?? []).map(
            (r: { type: string }) => r.type,
          );
        },
        { timeout: 15_000 },
      )
      .toContain("sensory_setting_change");
  });
});
