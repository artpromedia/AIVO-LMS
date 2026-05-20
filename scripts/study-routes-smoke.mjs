#!/usr/bin/env node
/**
 * Staging smoke for learner study routes.
 *
 * Crawls a deployed environment, fetches every route in the manifest,
 * and fails (exit 1) if the rendered HTML contains any banned phrase
 * (stub / coming-soon / quest-world-not-found / etc).
 *
 * Usage:
 *   STAGING_BASE_URL=https://staging.example.com \
 *   STAGING_LEARNER_TOKEN=eyJ... \
 *   node scripts/study-routes-smoke.mjs
 *
 * Pairs with the Playwright crawler at
 *   apps/web-v2/e2e/learner-study-routes.spec.ts
 * which mocks the backend; this one talks to the real backend.
 */

const BASE = (process.env.STAGING_BASE_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.STAGING_LEARNER_TOKEN || "";

if (!BASE) {
  console.error("[smoke] STAGING_BASE_URL is required");
  process.exit(2);
}

const QUEST_WORLD_KEYS = [
  "nova_number_galaxy",
  "sage_story_kingdom",
  "spark_science_lab",
  "chrono_time_tower",
  "pixel_code_forge",
];
const TUTOR_KEYS = ["nova", "sage", "spark", "chrono", "pixel"];

const BANNED_PHRASES = [
  "coming soon",
  "stub surface",
  "placeholder content",
  "demo content",
  "mock content",
  "lorem ipsum",
  "todo:",
  "fixme:",
  "quest world not found",
  "tutor not found",
];

const ROUTES = [
  "/dashboard/learner/quests",
  ...QUEST_WORLD_KEYS.map((k) => `/dashboard/learner/quests/${k}`),
  ...TUTOR_KEYS.map((k) => `/dashboard/learner/tutors/${k}`),
];

function authHeaders() {
  const h = { "User-Agent": "aivo-study-route-smoke" };
  if (TOKEN) h["Authorization"] = `Bearer ${TOKEN}`;
  return h;
}

async function probe(path) {
  const url = `${BASE}${path}`;
  let resp;
  try {
    resp = await fetch(url, { headers: authHeaders(), redirect: "follow" });
  } catch (err) {
    return { path, ok: false, reason: `fetch_failed: ${err.message}` };
  }
  const html = await resp.text();
  const lower = html.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      return { path, ok: false, status: resp.status, reason: `banned_phrase:${phrase}` };
    }
  }
  if (resp.status >= 500) {
    return { path, ok: false, status: resp.status, reason: "server_error" };
  }
  return { path, ok: true, status: resp.status };
}

async function main() {
  console.log(`[smoke] base=${BASE} routes=${ROUTES.length}`);
  const results = [];
  for (const path of ROUTES) {
    const result = await probe(path);
    results.push(result);
    if (result.ok) {
      console.log(`  ok   ${result.status ?? "-"}  ${result.path}`);
    } else {
      console.error(`  FAIL ${result.status ?? "-"}  ${result.path}  ${result.reason}`);
    }
  }
  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    console.error(`[smoke] ${failures.length} route(s) failed`);
    process.exit(1);
  }
  console.log("[smoke] all routes clean");
}

main().catch((err) => {
  console.error("[smoke] uncaught error:", err);
  process.exit(2);
});
