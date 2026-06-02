// k6 load test: SCIM 2.0 Users list (Sprint 1 — Enterprise Identity DoD).
//
// SLO: 100 requests/second sustained, p95 < 300 ms, error rate < 1%.
//
// Run:
//   k6 run --env BASE_URL=https://identity.staging.aivolms.com \
//          --env SCIM_TOKEN=$SCIM_BEARER \
//          scripts/load/scim-users.k6.js
//
// The SCIM list endpoint is bearer-authenticated (tokens are hashed at
// rest in identity-svc); supply a valid provisioning token via SCIM_TOKEN.

import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const SCIM_TOKEN = __ENV.SCIM_TOKEN || "";
// SCIM list supports pagination; exercise a realistic page size.
const COUNT = __ENV.SCIM_COUNT || "50";

if (!SCIM_TOKEN) {
  throw new Error("SCIM_TOKEN env var is required");
}

export const options = {
  scenarios: {
    scim_users_list: {
      // Fixed-rate arrival so we measure latency at exactly the SLO load
      // rather than a VU-bound ramp.
      executor: "constant-arrival-rate",
      rate: 100,
      timeUnit: "1s",
      duration: "3m",
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{endpoint:scim-users}": ["p(95)<300"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/scim/v2/Users?startIndex=1&count=${COUNT}`, {
    headers: {
      Authorization: `Bearer ${SCIM_TOKEN}`,
      Accept: "application/scim+json",
      "x-load-test": "1",
    },
    timeout: "10s",
    tags: { endpoint: "scim-users" },
  });
  check(res, {
    "status is 200": (r) => r.status === 200,
    "is SCIM ListResponse": (r) => {
      try {
        const body = r.json();
        return (
          Array.isArray(body.schemas) &&
          body.schemas.includes("urn:ietf:params:scim:api:messages:2.0:ListResponse")
        );
      } catch {
        return false;
      }
    },
  });
}

export function handleSummary(data) {
  const m = data.metrics["http_req_duration{endpoint:scim-users}"] || data.metrics.http_req_duration;
  const p95 = m ? (m.values["p(95)"] || 0).toFixed(0) : "n/a";
  return {
    "scripts/load/results/scim-users-summary.json": JSON.stringify(data, null, 2),
    stdout: `scim-users: p95=${p95}ms (SLO <300ms @ 100 rps)\n`,
  };
}
