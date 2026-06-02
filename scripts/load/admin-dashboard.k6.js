// k6 load test: Admin / school dashboard BFF
//
// Run: k6 run --env BASE_URL=https://staging.aivo.internal \
//             --env LOAD_TEST_TOKEN=$LOAD_TEST_TOKEN \
//             scripts/load/admin-dashboard.k6.js
//
// Threshold: p(95) < 500ms.

import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TOKEN = __ENV.LOAD_TEST_TOKEN || "";

if (!TOKEN) {
  throw new Error("LOAD_TEST_TOKEN env var is required");
}

export const options = {
  scenarios: {
    admin_dashboard: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "60s", target: 200 },
        { duration: "4m", target: 200 },
        { duration: "60s", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/bff/admin/school/dashboard`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "x-load-test": "1",
    },
    timeout: "10s",
    tags: { endpoint: "admin-dashboard" },
  });
  check(res, {
    "status is 200": (r) => r.status === 200,
    "has body": (r) => !!r.body && r.body.length > 0,
  });
}

export function handleSummary(data) {
  return {
    "scripts/load/results/admin-dashboard-summary.json": JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  const m = data.metrics.http_req_duration;
  if (!m) return "no http_req_duration metric collected\n";
  const p95 = (m.values["p(95)"] || 0).toFixed(0);
  return `admin-dashboard: p95=${p95}ms\n`;
}
