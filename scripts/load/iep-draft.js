// Sprint 12 — k6 load test for POST /api/ai/iep/draft.
//
// SLO contract: p95 < 40 s with 25 concurrent VUs for 5 minutes,
// failure rate < 1 %.

import http from "k6/http";
import { sleep } from "k6";
import {
  AI_BASE_URL,
  LEARNER_ID,
  authHeaders,
  expectOk,
  requiredEnvAssertion,
  sleepWithJitter,
} from "./lib/common.js";

export const options = {
  scenarios: {
    iep_draft: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 5 },
        { duration: "1m", target: 25 },
        { duration: "5m", target: 25 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<40000"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
};

export default function () {
  requiredEnvAssertion();
  const body = {
    learner_id: LEARNER_ID,
    parent_assessment: {
      functioningLevel: "SUPPORTED",
      diagnoses: ["ADHD"],
      responses: {
        "str-1": ["math facts"],
        "ch-1": ["reading fluency"],
        "pref-1": ["Minecraft"],
      },
    },
    learning_profile: {
      thetaPlacement: 0.5,
      modalityFit: [
        { modality: "visual", accuracy: 0.85, n: 6 },
        { modality: "auditory", accuracy: 0.6, n: 5 },
      ],
      processingSpeedMs: 4500,
      frustrationRate: 0.3,
      frustrationTolerance: "moderate",
      attentionRunLength: 8,
    },
    domain_scores: {
      math: { correct: 5, total: 6, difficulty: 2, avgLatencyMs: 4200 },
      ela: { correct: 2, total: 6, difficulty: 1, avgLatencyMs: 8200 },
    },
  };
  const res = http.post(`${AI_BASE_URL}/api/ai/iep/draft`, JSON.stringify(body), {
    headers: authHeaders(),
    timeout: "75s",
    tags: { endpoint: "iep-draft" },
  });
  expectOk(res, "iep-draft");
  sleep(sleepWithJitter(3, 1));
}
