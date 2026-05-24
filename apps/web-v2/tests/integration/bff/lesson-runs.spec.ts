/**
 * Sprint 0 Prompt 0.2 — BFF integration: lesson-runs contract.
 *
 * Targets `/api/bff/learners/[id]/lesson-runs` (GET list, POST create).
 * Locks the failure envelope that `packages/api-client/src/learning-svc`
 * consumers depend on.
 */
import { test } from "@playwright/test";
import {
  MOCK_LEARNER_ID,
  STRANGER_LEARNER_ID,
  expectFailureEnvelope,
  mockCookie,
} from "./_helpers";

test.describe("BFF: /api/bff/learners/[id]/lesson-runs", () => {
  test("GET unauthenticated → 401 UNAUTHENTICATED envelope", async ({ request }) => {
    const res = await request.get(`/api/bff/learners/${STRANGER_LEARNER_ID}/lesson-runs`);
    await expectFailureEnvelope(res, { status: 401, code: "UNAUTHENTICATED" });
  });

  test("POST unauthenticated → 401 UNAUTHENTICATED envelope", async ({ request }) => {
    const res = await request.post(`/api/bff/learners/${STRANGER_LEARNER_ID}/lesson-runs`, {
      data: { subjectId: "subj_math", skillId: "skl_demo", source: "lesson" },
    });
    await expectFailureEnvelope(res, { status: 401, code: "UNAUTHENTICATED" });
  });

  test("GET as parent on stranger learner → 403 FORBIDDEN_LEARNER envelope", async ({
    request,
  }) => {
    const res = await request.get(`/api/bff/learners/${STRANGER_LEARNER_ID}/lesson-runs`, {
      headers: { cookie: mockCookie("parent") },
    });
    await expectFailureEnvelope(res, { status: 403, code: "FORBIDDEN_LEARNER" });
  });

  test("POST as learner on self with empty body → 400 VALIDATION_FAILED envelope", async ({
    request,
  }) => {
    const res = await request.post(`/api/bff/learners/${MOCK_LEARNER_ID}/lesson-runs`, {
      headers: { cookie: mockCookie("learner") },
      data: {},
    });
    await expectFailureEnvelope(res, { status: 400, code: "VALIDATION_FAILED" });
  });
});
