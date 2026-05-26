// Sprint 12 — k6 load test for POST /api/ai/generate-baseline.
//
// SLO contract: p95 < 30 s with 50 concurrent VUs for 5 minutes,
// failure rate < 1 %. Threshold violation fails the run (exit != 0).
//
// Run:
//   K6_API_TOKEN=... K6_TENANT_ID=... K6_LEARNER_ID=... \
//   k6 run scripts/load/baseline-generate.js

import http from "k6/http";
import { sleep } from "k6";
import {
  AI_BASE_URL,
  authHeaders,
  expectOk,
  requiredEnvAssertion,
  sleepWithJitter,
} from "./lib/common.js";

export const options = {
  scenarios: {
    baseline_generate: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "1m", target: 50 },
        { duration: "5m", target: 50 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<30000"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
};

const PARENT_ASSESSMENT_PAYLOAD = {
  communicationMode: "verbal",
  deviceInteraction: "independent",
  responseMethod: "touch_select",
  attentionSpan: "typical",
  diagnoses: [],
  functioningLevel: "STANDARD",
  responses: {
    "ls-1": "visual",
    "str-1": ["math facts", "drawing"],
    "ch-1": ["reading fluency"],
    "pref-1": ["soccer", "Minecraft"],
    "fl-5": "3",
    "fl-7": "3",
    "ls-3": 4,
    "se-1": 4,
  },
};

export default function () {
  requiredEnvAssertion();
  const res = http.post(
    `${AI_BASE_URL}/api/ai/generate-baseline`,
    JSON.stringify({
      parent_assessment: PARENT_ASSESSMENT_PAYLOAD,
      functioning_level: "STANDARD",
      // ZIP triggers the Sprint 1 curriculum-grounding lookup so the
      // load test exercises that path too.
      zip_code: __ENV.K6_LOAD_ZIP || "55101",
    }),
    {
      headers: authHeaders(),
      // Per-request timeout > p95 SLO so the request doesn't get cut
      // off by k6 before LLM completion.
      timeout: "60s",
      tags: { endpoint: "generate-baseline" },
    },
  );
  expectOk(res, "generate-baseline");
  sleep(sleepWithJitter(2, 1));
}
