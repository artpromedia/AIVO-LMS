/**
 * Sprint 0 Prompt 0.2 — BFF integration: learner home (today) contract.
 *
 * The prompt names "/api/bff/learners/[id]/home"; in this codebase the
 * learner-home BFF route lives at `/api/bff/learners/[id]/today`
 * (see apps/web-v2/app/api/bff/learners/[learnerId]/today/route.ts).
 *
 * These tests run against a real, freshly-built web-v2 in AUTH_MODE=mock.
 * They lock the failure envelope shape that `packages/api-client` and
 * every consuming UI relies on.
 */
import { test } from "@playwright/test";
import { STRANGER_LEARNER_ID, expectFailureEnvelope, mockCookie } from "./_helpers";

test.describe("BFF: GET /api/bff/learners/[id]/today (home)", () => {
  test("unauthenticated → 401 UNAUTHENTICATED envelope", async ({ request }) => {
    const res = await request.get(`/api/bff/learners/${STRANGER_LEARNER_ID}/today`);
    await expectFailureEnvelope(res, { status: 401, code: "UNAUTHENTICATED" });
  });

  test("parent cookie on stranger learner → 403 FORBIDDEN_LEARNER envelope", async ({
    request,
  }) => {
    const res = await request.get(`/api/bff/learners/${STRANGER_LEARNER_ID}/today`, {
      headers: { cookie: mockCookie("parent") },
    });
    await expectFailureEnvelope(res, { status: 403, code: "FORBIDDEN_LEARNER" });
  });
});
