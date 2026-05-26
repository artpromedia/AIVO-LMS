// Sprint 12 — k6 load test for GET /api/bff/admin/baseline-metrics.
//
// SLO contract: p95 < 600 ms with 100 concurrent VUs for 10 minutes,
// failure rate < 0.1 %.

import http from "k6/http";
import { sleep } from "k6";
import {
  BASE_URL,
  authHeaders,
  expectOk,
  requiredEnvAssertion,
  sleepWithJitter,
} from "./lib/common.js";

export const options = {
  scenarios: {
    baseline_metrics: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 25 },
        { duration: "1m", target: 100 },
        { duration: "10m", target: 100 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<600", "p(99)<1500"],
    http_req_failed: ["rate<0.001"],
    checks: ["rate>0.999"],
  },
};

export default function () {
  requiredEnvAssertion();
  const res = http.get(`${BASE_URL}/api/bff/admin/baseline-metrics`, {
    headers: authHeaders(),
    tags: { endpoint: "baseline-metrics" },
  });
  expectOk(res, "baseline-metrics");
  sleep(sleepWithJitter(0.5, 0.3));
}
