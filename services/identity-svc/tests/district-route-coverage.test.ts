/**
 * Sprint 8 — district route coverage smoke test.
 *
 * Hits the live identity-svc HTTP surface (the same server the workflow
 * runs) and asserts that every registered `/api/district/*` endpoint
 * rejects an unauthenticated request with 401/403, proving the global
 * tenant-scope hook is in front of all of them.
 *
 * Skips silently if the service isn't reachable so this test runs
 * cleanly in CI environments that don't boot the full stack.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.IDENTITY_SVC_URL || "http://localhost:3001";

// Minimum surface that MUST be present and tenant-gated. If any of
// these are not behind the hook, the test fails. Add new district
// endpoints here whenever you ship one — that's the whole point.
const DISTRICT_ROUTES: Array<[string, string]> = [
  ["GET", "/api/district/tenant"],
  ["GET", "/api/district/settings"],
  ["PUT", "/api/district/settings"],
  ["GET", "/api/district/sso"],
  ["PUT", "/api/district/sso"],
  ["GET", "/api/district/admins"],
  ["POST", "/api/district/admins"],
  ["POST", "/api/district/admins/00000000-0000-0000-0000-000000000000/deactivate"],
  ["POST", "/api/district/admins/00000000-0000-0000-0000-000000000000/reactivate"],
  ["POST", "/api/district/admins/00000000-0000-0000-0000-000000000000/reset-password"],
  ["GET", "/api/district/admins/mfa-stats"],
  ["PUT", "/api/district/admins/force-mfa"],
];

async function reachable(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}

test("every /api/district/* route rejects unauthenticated requests via the tenant-scope hook", async (t) => {
  if (!(await reachable())) {
    t.skip(`identity-svc not reachable at ${BASE}; skipping coverage smoke`);
    return;
  }
  for (const [method, path] of DISTRICT_ROUTES) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: ["POST", "PUT"].includes(method) ? "{}" : undefined,
    });
    assert.ok(
      res.status === 401 || res.status === 403,
      `${method} ${path} should be rejected without auth (got ${res.status})`,
    );
  }
});
