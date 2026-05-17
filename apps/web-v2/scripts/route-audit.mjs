#!/usr/bin/env node
/**
 * Sprint 22: route + dead-link + ComingSoon audit.
 *
 * 1. Enumerates every `page.tsx` under `app/` (skipping route groups,
 *    api/, dynamic-only segments) and HTTP GETs each route for every demo
 *    role. Records the status code per role.
 * 2. Greps every `.tsx` for `href="/..."` literals, dedups, and asserts each
 *    href resolves to an enumerated route or external URL.
 * 3. Fails if any `ComingSoon` or `Ships in Sprint` text remains in `app/`.
 *
 * Usage:
 *   BASE_URL=http://localhost:5000 node scripts/route-audit.mjs
 *   exits non-zero on any failure.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const APP = join(ROOT, "app");
const BASE = process.env.BASE_URL || "http://localhost:5000";

const ROLES = ["parent", "learner", "teacher", "school_admin", "district_admin", "platform_admin"];
const COOKIE = (role) => `aivo_mock_session=${role}`;

// -------------------- enumerate routes --------------------
function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "api") continue;
      walk(full, acc);
    } else if (entry === "page.tsx") {
      acc.push(relative(APP, dir));
    }
  }
  return acc;
}

function dirToRoute(dir) {
  if (dir === "" || dir === ".") return "/";
  const parts = dir.split("/").filter((p) => !p.startsWith("(") || !p.endsWith(")"));
  return "/" + parts.join("/");
}

const dirs = walk(APP);
const routes = dirs.map(dirToRoute);
const staticRoutes = routes.filter((r) => !r.includes("[")); // only static for fetch test

// -------------------- ComingSoon check --------------------
function rgScan(dir, re, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) rgScan(full, re, acc);
    else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      const txt = readFileSync(full, "utf8");
      if (re.test(txt)) acc.push(relative(ROOT, full));
    }
  }
  return acc;
}
const comingSoonHits = rgScan(APP, /ComingSoon|Ships in Sprint/);

// -------------------- dead-link audit --------------------
const HREF_RE = /href=["'](\/[^"'#?]*)["']/g;
const allHrefs = new Set();
function gatherHrefs(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) gatherHrefs(full);
    else if (entry.endsWith(".tsx")) {
      const txt = readFileSync(full, "utf8");
      let m;
      while ((m = HREF_RE.exec(txt)) !== null) allHrefs.add(m[1]);
    }
  }
}
gatherHrefs(APP);
gatherHrefs(join(ROOT, "components"));

const knownStatic = new Set(staticRoutes);
const knownPatterns = routes
  .filter((r) => r.includes("["))
  .map((r) => new RegExp("^" + r.replace(/\[[^\]]+\]/g, "[^/]+") + "$"));

const allowExternalPrefixes = ["/api/", "/login", "/signup", "/settings/accessibility", "/"];
const deadHrefs = [];
for (const h of allHrefs) {
  if (h.startsWith("/api/")) continue;
  if (h === "/") continue;
  if (knownStatic.has(h)) continue;
  if (knownPatterns.some((re) => re.test(h))) continue;
  if (allowExternalPrefixes.includes(h)) continue;
  deadHrefs.push(h);
}

// -------------------- HTTP probe --------------------
async function probe(route, role) {
  const res = await fetch(`${BASE}${route}`, {
    headers: { cookie: COOKIE(role) },
    redirect: "manual",
  });
  return res.status;
}

const probeFailures = [];
console.log(`Probing ${staticRoutes.length} routes × ${ROLES.length} roles against ${BASE}…`);
for (const route of staticRoutes) {
  for (const role of ROLES) {
    try {
      const status = await probe(route, role);
      if (status >= 500) {
        probeFailures.push({ route, role, status });
      }
    } catch (e) {
      probeFailures.push({ route, role, status: `ERR ${e.message}` });
    }
  }
}

// -------------------- report --------------------
let failed = false;
if (comingSoonHits.length) {
  failed = true;
  console.error("\nFAIL: ComingSoon / 'Ships in Sprint' references found:");
  for (const f of comingSoonHits) console.error("  " + f);
}
if (deadHrefs.length) {
  failed = true;
  console.error("\nFAIL: dead hrefs (point to non-existent routes):");
  for (const h of [...deadHrefs].sort()) console.error("  " + h);
}
if (probeFailures.length) {
  failed = true;
  console.error("\nFAIL: 5xx responses:");
  for (const f of probeFailures) console.error(`  ${f.route} [${f.role}] -> ${f.status}`);
}

if (failed) {
  console.error("\nAudit failed.");
  process.exit(1);
}
console.log(`\nOK — ${staticRoutes.length} static routes, ${routes.length - staticRoutes.length} dynamic, ${allHrefs.size} href literals, 0 dead, 0 ComingSoon.`);
