// k6 load test: AI baseline generation
//
// Run: k6 run --env BASE_URL=https://staging.aivo.internal \
//             --env LOAD_TEST_TOKEN=$LOAD_TEST_TOKEN \
//             scripts/load/baseline.k6.js
//
// Threshold: p(95) < 30s. Run summary is written to
// scripts/load/results/baseline-summary.json on completion.

import http from "k6/http";
import { check } from "k6";
import { SharedArray } from "k6/data";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TOKEN = __ENV.LOAD_TEST_TOKEN || "";

if (!TOKEN) {
  throw new Error("LOAD_TEST_TOKEN env var is required");
}

const learners = new SharedArray("learners", () => [
  { learnerId: "lrn_load_001", subject: "math", grade: "3" },
  { learnerId: "lrn_load_002", subject: "reading", grade: "4" },
  { learnerId: "lrn_load_003", subject: "science", grade: "5" },
  { learnerId: "lrn_load_004", subject: "math", grade: "2" },
  { learnerId: "lrn_load_005", subject: "reading", grade: "6" },
]);

export const options = {
  scenarios: {
    baseline_generation: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "60s", target: 50 },
        { duration: "4m", target: 50 },
        { duration: "60s", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<30000"],
  },
};

export default function () {
  const payload = JSON.stringify(learners[Math.floor(Math.random() * learners.length)]);
  const res = http.post(`${BASE_URL}/api/ai/generate-baseline`, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      "x-load-test": "1",
    },
    timeout: "60s",
    tags: { endpoint: "baseline" },
  });
  check(res, {
    "status is 200/202": (r) => r.status === 200 || r.status === 202,
    "has body": (r) => !!r.body && r.body.length > 0,
  });
}

export function handleSummary(data) {
  return {
    "scripts/load/results/baseline-summary.json": JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  const m = data.metrics.http_req_duration;
  if (!m) return "no http_req_duration metric collected\n";
  const p95 = (m.values["p(95)"] || 0).toFixed(0);
  const avg = (m.values.avg || 0).toFixed(0);
  return `baseline: p95=${p95}ms avg=${avg}ms\n`;
}
