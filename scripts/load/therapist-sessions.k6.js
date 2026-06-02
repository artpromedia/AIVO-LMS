// k6 load test: Therapist sessions BFF
//
// Run: k6 run --env BASE_URL=https://staging.aivo.internal \
//             --env LOAD_TEST_TOKEN=$LOAD_TEST_TOKEN \
//             scripts/load/therapist-sessions.k6.js
//
// Threshold: p(95) < 800ms.

import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TOKEN = __ENV.LOAD_TEST_TOKEN || "";

if (!TOKEN) {
  throw new Error("LOAD_TEST_TOKEN env var is required");
}

export const options = {
  scenarios: {
    therapist_sessions: {
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
    http_req_duration: ["p(95)<800"],
  },
};

const samplePayload = {
  learnerId: "lrn_load_th_001",
  sessionType: "speech",
  scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
  durationMinutes: 30,
  notes: "Load test seed session",
};

export default function () {
  const res = http.post(`${BASE_URL}/api/bff/therapist/sessions`, JSON.stringify(samplePayload), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      "x-load-test": "1",
    },
    timeout: "10s",
    tags: { endpoint: "therapist-sessions" },
  });
  check(res, {
    "status is 200/201": (r) => r.status === 200 || r.status === 201,
    "has body": (r) => !!r.body && r.body.length > 0,
  });
}

export function handleSummary(data) {
  return {
    "scripts/load/results/therapist-sessions-summary.json": JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  const m = data.metrics.http_req_duration;
  if (!m) return "no http_req_duration metric collected\n";
  const p95 = (m.values["p(95)"] || 0).toFixed(0);
  return `therapist-sessions: p95=${p95}ms\n`;
}
