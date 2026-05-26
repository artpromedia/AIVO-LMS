// Sprint 12 — k6 load test for GET /api/bff/admin/school/dashboard.
//
// SLO contract: p95 < 500 ms with 200 concurrent VUs for 10 minutes,
// failure rate < 0.1 % (this is a read endpoint — failures should be
// near zero).

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
    school_dashboard: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 50 },
        { duration: "1m", target: 200 },
        { duration: "10m", target: 200 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1500"],
    http_req_failed: ["rate<0.001"],
    checks: ["rate>0.999"],
  },
};

export default function () {
  requiredEnvAssertion();
  const res = http.get(`${BASE_URL}/api/bff/admin/school/dashboard`, {
    headers: authHeaders(),
    tags: { endpoint: "school-dashboard" },
  });
  expectOk(res, "school-dashboard");
  sleep(sleepWithJitter(0.5, 0.3));
}
