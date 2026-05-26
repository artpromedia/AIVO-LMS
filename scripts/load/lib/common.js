// Sprint 12 — shared helpers for the AIVO k6 load suite.
//
// Centralises base URL resolution, the load-actor auth token, and a
// `expectOk()` check that fails the iteration on any non-2xx so the
// threshold-based SLO numbers stay honest.

import { check } from "k6";

export const BASE_URL = __ENV.BASE_URL || "https://staging.aivolms.com";
export const AI_BASE_URL = __ENV.AI_BASE_URL || BASE_URL;
export const ASSESSMENT_BASE_URL = __ENV.ASSESSMENT_BASE_URL || BASE_URL;
export const API_TOKEN = __ENV.K6_API_TOKEN || "";
export const TENANT_ID = __ENV.K6_TENANT_ID || "";
export const LEARNER_ID = __ENV.K6_LEARNER_ID || "";

export function authHeaders() {
  if (!API_TOKEN) {
    throw new Error("K6_API_TOKEN env var is required");
  }
  return {
    Authorization: `Bearer ${API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

export function requiredEnvAssertion() {
  if (!API_TOKEN || !TENANT_ID || !LEARNER_ID) {
    throw new Error(
      "Set K6_API_TOKEN, K6_TENANT_ID, and K6_LEARNER_ID before running the load suite.",
    );
  }
}

export function expectOk(res, label) {
  return check(res, {
    [`${label} status 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${label} body present`]: (r) => r.body && r.body.length > 0,
  });
}

export function expectStatusOneOf(res, label, allowed) {
  return check(res, {
    [`${label} status in [${allowed.join(",")}]`]: (r) => allowed.includes(r.status),
  });
}

/** Pause between iterations using a jittered constant so we don't
 *  produce a sawtooth load profile that's easy to overoptimise for. */
export function sleepWithJitter(base = 1, jitter = 0.5) {
  const v = base + (Math.random() - 0.5) * jitter;
  // k6 sleep is a top-level import in the calling script — we just
  // return the value so the caller can pass it to sleep().
  return Math.max(0.1, v);
}
