// Sprint 12 — k6 load test for POST /api/bff/therapist/sessions.
//
// SLO contract: p95 < 800 ms with 50 concurrent VUs for 5 minutes,
// failure rate < 0.5 %.
//
// This is a WRITE endpoint, so a non-trivial failure rate is allowed
// (cross-tenant denials etc.) — the load actor uses a tenant that
// owns LEARNER_ID so the happy path dominates.

import http from "k6/http";
import { sleep } from "k6";
import {
  BASE_URL,
  LEARNER_ID,
  authHeaders,
  expectOk,
  requiredEnvAssertion,
  sleepWithJitter,
} from "./lib/common.js";

export const options = {
  scenarios: {
    therapist_sessions: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "1m", target: 50 },
        { duration: "5m", target: 50 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<800", "p(99)<2000"],
    http_req_failed: ["rate<0.005"],
    checks: ["rate>0.99"],
  },
};

export default function () {
  requiredEnvAssertion();
  const body = {
    learnerId: LEARNER_ID,
    durationMinutes: 30,
    subjective: "Load test — learner arrived calm.",
    objective: "10 trials of target sound, 6 correct.",
    assessment: "Approaching target.",
    plan: "Continue current intervention.",
    goalIds: [],
  };
  const res = http.post(
    `${BASE_URL}/api/bff/therapist/sessions`,
    JSON.stringify(body),
    {
      headers: authHeaders(),
      tags: { endpoint: "therapist-sessions" },
    },
  );
  expectOk(res, "therapist-sessions");
  sleep(sleepWithJitter(1, 0.5));
}
