#!/usr/bin/env node
/**
 * Sprint 08 — production E2E certification smoke harness.
 *
 * Verifies that the live cluster is serving the sprint-08 build of
 * tutor-svc with the full Sprint 04/05/06 endpoint surface wired and
 * auth-gated. Designed to be cluster-internal-friendly: defaults the
 * base URL to the service DNS name so the same script can be executed
 * via `kubectl run` against tutor-svc.aivo.svc.cluster.local without
 * routing through ingress / Cloudflare.
 *
 * Environment:
 *   SMOKE_BASE_URL  default http://tutor-svc.aivo.svc.cluster.local:3000
 *   SMOKE_TIMEOUT_MS default 5000
 *
 * Exit code is 0 only when every check passes. No demo fallbacks — a
 * failed network call is a failed certification.
 */

const BASE_URL =
  process.env.SMOKE_BASE_URL ||
  "http://tutor-svc.aivo.svc.cluster.local:3000";
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || "5000");

/** Single HTTP check spec. */
const CHECKS = [
  // Cluster health.
  {
    name: "GET /api/tutors/health → 200",
    method: "GET",
    path: "/api/tutors/health",
    expectStatus: 200,
    expectJson: (j) => j && j.status === "ok",
  },
  // Sprint 08 version stamp (public).
  {
    name: "GET /api/tutors/version → 200 sprint-08",
    method: "GET",
    path: "/api/tutors/version",
    expectStatus: 200,
    expectJson: (j) => j && j.sprint === "sprint-08" && j.service === "tutor-svc",
  },
  // Sprint 04 — tutor surface beats.
  {
    name: "POST /api/tutor/example/surface-beats → 401 without bearer",
    method: "POST",
    path: "/api/tutor/example/surface-beats",
    body: { learnerId: "smoke" },
    expectStatus: 401,
  },
  // Sprint 05 — surface submit.
  {
    name: "POST /api/tutor/surface-submit → 401 without bearer",
    method: "POST",
    path: "/api/tutor/surface-submit",
    body: { learnerId: "smoke", surfaceId: "x", commands: [] },
    expectStatus: 401,
  },
  // Sprint 06 — recommendation candidates.
  {
    name: "POST /api/tutor/recommendation-candidates → 401 without bearer",
    method: "POST",
    path: "/api/tutor/recommendation-candidates",
    body: { learnerId: "smoke", samples: [] },
    expectStatus: 401,
  },
];

async function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function runCheck(check) {
  const url = `${BASE_URL}${check.path}`;
  const init = {
    method: check.method,
    headers: { "content-type": "application/json" },
  };
  if (check.body !== undefined) {
    init.body = JSON.stringify(check.body);
  }
  let res;
  try {
    res = await withTimeout(fetch(url, init), TIMEOUT_MS);
  } catch (err) {
    return { ok: false, name: check.name, reason: `network: ${err.message}` };
  }
  if (res.status !== check.expectStatus) {
    return {
      ok: false,
      name: check.name,
      reason: `expected status ${check.expectStatus}, got ${res.status}`,
    };
  }
  if (check.expectJson) {
    let body;
    try {
      body = await res.json();
    } catch (err) {
      return { ok: false, name: check.name, reason: `invalid JSON: ${err.message}` };
    }
    if (!check.expectJson(body)) {
      return {
        ok: false,
        name: check.name,
        reason: `payload did not match: ${JSON.stringify(body)}`,
      };
    }
  }
  return { ok: true, name: check.name };
}

async function main() {
  console.log(`sprint08 prod smoke — base ${BASE_URL}`);
  const results = [];
  for (const check of CHECKS) {
    // eslint-disable-next-line no-await-in-loop
    const r = await runCheck(check);
    results.push(r);
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `  (${r.reason})`}`);
  }
  const failures = results.filter((r) => !r.ok);
  console.log(`\nsprint08 smoke: ${results.length - failures.length}/${results.length} passed`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
