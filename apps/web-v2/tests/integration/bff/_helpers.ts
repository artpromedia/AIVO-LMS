/**
 * Sprint 0 Prompt 0.2 — shared BFF integration test helpers.
 *
 * Asserts the canonical response envelope shape emitted by every BFF
 * route via `ok()` / `fail()` in `apps/web-v2/lib/bff/response.ts`.
 * If anyone changes the envelope (e.g. flattens `error`, drops
 * `requestId`, renames `userMessage`), every spec in this folder fails
 * — which is the contract guarantee `packages/api-client` relies on.
 */
import { expect, type APIResponse } from "@playwright/test";

export type BffFailureBody = {
  ok: false;
  requestId: string;
  error: {
    code: string;
    message: string;
    userMessage: string;
    retryable: boolean;
  };
};

export type BffSuccessBody<T> = {
  ok: true;
  requestId: string;
  data: T;
};

/** Cookie header for AUTH_MODE=mock — see apps/web-v2/lib/auth/mock-session.ts. */
export function mockCookie(role: "parent" | "learner" | "teacher" | "school_admin"): string {
  return `aivo_mock_session=${role}`;
}

/** A learnerId the mock parent/learner is NOT linked to — guaranteed FORBIDDEN_LEARNER. */
export const STRANGER_LEARNER_ID = "lrn_stranger_test_0000";

/** The seeded mock learner — see MOCK_USERS.learner.learnerId. */
export const MOCK_LEARNER_ID = "lrn_demo_sky";

export async function expectFailureEnvelope(
  res: APIResponse,
  expected: { status: number; code: string },
): Promise<BffFailureBody> {
  expect(res.status(), `unexpected status for ${res.url()}`).toBe(expected.status);
  expect(res.headers()["x-request-id"], "x-request-id response header missing").toBeTruthy();
  const body = (await res.json()) as BffFailureBody;
  expect(body).toMatchObject({
    ok: false,
    requestId: expect.any(String),
    error: {
      code: expected.code,
      message: expect.any(String),
      userMessage: expect.any(String),
      retryable: expect.any(Boolean),
    },
  });
  expect(body.requestId.length).toBeGreaterThan(0);
  return body;
}
