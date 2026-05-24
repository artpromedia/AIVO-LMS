/**
 * Sprint 0 Prompt 0.2 — BFF integration: tutor reply contract.
 *
 * Targets `/api/bff/learners/[id]/tutor/reply` (POST). Role-restricted
 * to `learner`; locks the auth + envelope contract that the chat UI
 * and any future `packages/api-client/tutor-svc` consumers depend on.
 */
import { test } from "@playwright/test";
import {
  MOCK_LEARNER_ID,
  STRANGER_LEARNER_ID,
  expectFailureEnvelope,
  mockCookie,
} from "./_helpers";

test.describe("BFF: POST /api/bff/learners/[id]/tutor/reply", () => {
  test("unauthenticated → 401 UNAUTHENTICATED envelope", async ({ request }) => {
    const res = await request.post(`/api/bff/learners/${STRANGER_LEARNER_ID}/tutor/reply`, {
      data: { text: "Help me with fractions" },
    });
    await expectFailureEnvelope(res, { status: 401, code: "UNAUTHENTICATED" });
  });

  test("parent cookie (wrong role) → 403 FORBIDDEN_ROLE envelope", async ({ request }) => {
    const res = await request.post(`/api/bff/learners/${MOCK_LEARNER_ID}/tutor/reply`, {
      headers: { cookie: mockCookie("parent") },
      data: { text: "Help me with fractions" },
    });
    await expectFailureEnvelope(res, { status: 403, code: "FORBIDDEN_ROLE" });
  });

  test("learner cookie on stranger learner → 403 FORBIDDEN_LEARNER envelope", async ({
    request,
  }) => {
    const res = await request.post(`/api/bff/learners/${STRANGER_LEARNER_ID}/tutor/reply`, {
      headers: { cookie: mockCookie("learner") },
      data: { text: "Help me with fractions" },
    });
    await expectFailureEnvelope(res, { status: 403, code: "FORBIDDEN_LEARNER" });
  });

  test("learner cookie on self with empty text → 400 VALIDATION_FAILED envelope", async ({
    request,
  }) => {
    const res = await request.post(`/api/bff/learners/${MOCK_LEARNER_ID}/tutor/reply`, {
      headers: { cookie: mockCookie("learner") },
      data: { text: "" },
    });
    await expectFailureEnvelope(res, { status: 400, code: "VALIDATION_FAILED" });
  });
});
