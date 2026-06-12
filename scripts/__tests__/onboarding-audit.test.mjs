// onboarding:audit hrefTemplate resolver guard.
//
// Every readiness hrefTemplate must point to a real backing file under
// apps/web-v2/app/. That backing file may be EITHER a rendered page
// (page.tsx) OR a Route Handler (route.ts) that sets a cookie or
// redirects — e.g. /learner/select/auto/route.ts. Restricting the
// resolver to page.tsx would cause a brittle false-positive whenever
// the onboarding flow exposes a redirect-only step.
//
// This test asserts BOTH cases resolve, and a fully-missing href is
// still rejected (the guard is not weakened).

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");

// Mirror the audit script's resolution logic (kept in lock-step with
// scripts/onboarding-audit.mjs §"For NEXT_STEP entries"): given an
// hrefTemplate, accept either page.tsx or route.ts as a backing file.
function resolveHrefTemplate(tpl) {
  const route = tpl.replace(/\{learnerId\}/g, "[learnerId]").replace(/\?.*$/, "");
  const pageRel = `apps/web-v2/app${route}/page.tsx`;
  const routeRel = `apps/web-v2/app${route}/route.ts`;
  const pageOk = existsSync(join(repoRoot, pageRel));
  const routeOk = existsSync(join(repoRoot, routeRel));
  return { pageOk, routeOk, ok: pageOk || routeOk, pageRel, routeRel };
}

test("hrefTemplate backed by a page.tsx resolves", () => {
  // /signup is the canonical onboarding entry point and is required to
  // exist by the same audit's REQUIRED_PAGES list.
  const r = resolveHrefTemplate("/signup");
  assert.ok(r.pageOk, `expected ${r.pageRel} to exist`);
  assert.ok(r.ok);
});

test("hrefTemplate backed by a route.ts resolves", () => {
  // /learner/select/auto is a Route Handler that sets a cookie and
  // 302s onward — no page.tsx, but the resolver must accept it.
  const r = resolveHrefTemplate("/learner/select/auto");
  assert.ok(r.routeOk, `expected ${r.routeRel} to exist`);
  assert.ok(r.ok);
});

test("rejects an hrefTemplate with neither backing file", () => {
  const r = resolveHrefTemplate("/__definitely_does_not_exist__/never");
  assert.equal(r.pageOk, false);
  assert.equal(r.routeOk, false);
  assert.equal(r.ok, false);
});

test("audit source still scans for both page.tsx and route.ts", () => {
  // Static guard against accidental narrowing of the audit script
  // back to page.tsx-only. If you legitimately change the file
  // extensions checked, update this assertion in the same commit.
  const auditSrc = readFileSync(join(__dirname, "..", "onboarding-audit.mjs"), "utf8");
  assert.match(auditSrc, /page\.tsx/);
  assert.match(auditSrc, /route\.ts/);
});

test("audit accepts nested READINESS_NEXT_STEP value fields", () => {
  const audit = spawnSync(process.execPath, ["scripts/onboarding-audit.mjs"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(audit.status, 0, `${audit.stdout}\n${audit.stderr}`);
  assert.doesNotMatch(audit.stderr, /labelKey.*not in ReadinessState/);
});
