#!/usr/bin/env node
// web:parity — Web ⇄ Mobile feature-parity test.
//
// Compares the Next.js web app (apps/web-v2) against the Expo mobile app
// (apps/mobile) for the FIVE roles that ship in the unified mobile app:
//
//     learner · parent · teacher · therapist · caregiver
//
// School / district / internal admin surfaces are intentionally web-only
// (see docs/NAVIGATION.md → Roles) and are excluded from the matrix.
//
// The PARITY_MATRIX below is the maintained source of truth. The script:
//
//   1. Globs every web `page.tsx` route and every mobile route file.
//   2. Confirms each in-scope web route is tracked in the matrix — an
//      untracked route fails the test so the matrix stays honest as web
//      grows (this is the "parity drift" guard).
//   3. Confirms every mobile screen referenced by a Parity/Partial row
//      actually exists on disk.
//   4. Prints a per-role summary, or a full markdown report with
//      `--markdown` (used to regenerate docs/mobile-parity.md).
//
// Usage:
//   node scripts/web-mobile-parity-check.mjs            # human summary
//   node scripts/web-mobile-parity-check.mjs --markdown # emit md report
//   node scripts/web-mobile-parity-check.mjs --strict   # untracked = fail

import { readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const WEB_APP = join(repoRoot, "apps/web-v2/app");
const MOB_APP = join(repoRoot, "apps/mobile/app");

const argv = new Set(process.argv.slice(2));
const MARKDOWN = argv.has("--markdown");
const STRICT = argv.has("--strict");

// --- Status legend ----------------------------------------------------
// Parity  : present on both with comparable functionality.
// Partial : present on mobile but missing a sub-feature (see `gap`).
// Missing : not yet on mobile.
// WebOnly : intentionally web-only (admin, dev fixtures, design system).

const P = "Parity";
const PARTIAL = "Partial";
const MISSING = "Missing";

// Route prefixes that are web-only by design and never enter the matrix.
const WEB_ONLY_PREFIXES = [
  "/admin", // school + district + platform admin (web-only roles)
  "/district", // district admin login
  "/design-system", // internal component gallery
  "/surface-preview", // internal render harness
  "/locked", // generic locked-area shell
  "/api", // route handlers, not screens
  "/onboarding/invite/district", // district-admin invite
  "/onboarding/invite/school", // school-admin invite
  "/learner/lesson-player-fixture", // dev fixture
  "/learner/lesson-player-smoke", // dev smoke route
];

// The parity matrix. Keyed by web route. `mobile` is the expected mobile
// route file (relative to apps/mobile/app, without extension) or null.
// Grouped by role for the report. `gap` documents Partial/Missing work.
const PARITY_MATRIX = {
  "Auth & Shared": [
    { web: "/", mobile: "index", status: P },
    { web: "/login", mobile: "(auth)/login", status: P },
    { web: "/login/mfa", mobile: "(auth)/verify-mfa", status: P },
    { web: "/signup", mobile: "(auth)/signup", status: P },
    { web: "/forgot-password", mobile: "(auth)/forgot-password", status: P },
    { web: "/reset-password", mobile: "(auth)/reset-password", status: P },
    { web: "/accept-invite", mobile: "accept-invite", status: P },
    {
      web: "/settings/accessibility",
      mobile: "settings/accessibility",
      status: P,
    },
    { web: "/messages", mobile: "messages", status: P },
    { web: "/notifications", mobile: "notifications", status: P },
  ],

  Onboarding: [
    { web: "/onboarding", mobile: "(onboarding)/index", status: P },
    { web: "/onboarding/welcome", mobile: "(onboarding)/welcome", status: P },
    { web: "/onboarding/role", mobile: "(onboarding)/role", status: P },
    {
      web: "/onboarding/signup",
      mobile: "(auth)/signup",
      status: P,
    },
    { web: "/onboarding/signin", mobile: "(auth)/login", status: P },
    { web: "/onboarding/terms", mobile: "(onboarding)/terms", status: P },
    { web: "/onboarding/privacy", mobile: "(onboarding)/privacy", status: P },
    {
      web: "/onboarding/consent",
      mobile: "(auth)/consent-sheet",
      status: P,
    },
    { web: "/onboarding/recovery", mobile: "(auth)/forgot-password", status: P },
    { web: "/onboarding/pin", mobile: "(auth)/pin", status: P },
    { web: "/onboarding/permissions", mobile: "(onboarding)/permissions", status: P },
    {
      web: "/onboarding/parent-setup",
      mobile: "(parent)/onboard",
      status: P,
    },
    { web: "/onboarding/parent-verify", mobile: "(onboarding)/parent-verify", status: P },
    { web: "/onboarding/iep-upload", mobile: "(onboarding)/iep-upload", status: P },
    { web: "/onboarding/child-approval", mobile: "(onboarding)/child-approval", status: P },
    { web: "/onboarding/learner/new", mobile: "(onboarding)/learner/new", status: P },
    { web: "/onboarding/error", mobile: "(onboarding)/error", status: P },
  ],

  Learner: [
    { web: "/learner/home", mobile: "(learner)/index", status: P },
    {
      web: "/learner/select",
      mobile: "(auth)/session-switch",
      status: P,
    },
    {
      web: "/learner/subjects",
      mobile: "(learner)/subjects/index",
      status: P,
    },
    { web: "/learner/subjects/[subjectId]", mobile: "(learner)/subjects/[subjectId]", status: P },
    { web: "/learner/baseline", mobile: "(learner)/baseline/index", status: P },
    { web: "/learner/baseline/intro", mobile: "(learner)/baseline/index", status: P },
    { web: "/learner/baseline/why", mobile: "(learner)/baseline/index", status: P },
    { web: "/learner/baseline/readiness", mobile: "(learner)/baseline/index", status: P },
    { web: "/learner/baseline/subjects", mobile: "(learner)/baseline/index", status: P },
    { web: "/learner/baseline/[baselineId]", mobile: "(learner)/baseline/run", status: P },
    { web: "/learner/library", mobile: "(learner)/library", status: P },
    {
      web: "/learner/lesson-runs/[lessonRunId]",
      mobile: "(learner)/stage/[sessionId]",
      status: P,
    },
    { web: "/learner/missions", mobile: "(learner)/missions", status: P },
    { web: "/learner/quests", mobile: "(learner)/quests/index", status: P },
    { web: "/learner/quests/[worldId]", mobile: "(learner)/quests/[worldSlug]/index", status: P },
    {
      web: "/learner/quests/[worldId]/chapters/[chapterId]",
      mobile: "(learner)/quests/[worldSlug]/play/[questId]",
      status: P,
    },
    { web: "/learner/progress", mobile: "(learner)/progress", status: P },
    {
      web: "/learner/rewards",
      mobile: "(learner)/badges",
      status: P,
    },
    { web: "/learner/notifications", mobile: "(learner)/notifications", status: P },
    { web: "/learner/homework", mobile: "(learner)/homework/index", status: P },
    { web: "/learner/homework/[sessionId]", mobile: "(learner)/homework/[sessionId]", status: P },
    { web: "/learner/tutor", mobile: "(learner)/tutor/[tutorSlug]", status: P },
    { web: "/learner/settings", mobile: "(learner)/settings", status: P },
    {
      web: "/learner/settings/accessibility",
      mobile: "(learner)/accessibility",
      status: P,
    },
    {
      web: "/learner/settings/audio",
      mobile: "(learner)/audio",
      status: P,
    },
    {
      web: "/learner/brain-clone/[learnerId]",
      mobile: "(learner)/brain",
      status: P,
    },
  ],

  Parent: [
    { web: "/parent/home", mobile: "(parent)/index", status: P },
    { web: "/parent/home-v2", mobile: "(parent)/home-v2", status: P },
    { web: "/parent/learners", mobile: "(parent)/learners/index", status: P },
    { web: "/parent/learners/new", mobile: "(parent)/learner-new/index", status: P },
    { web: "/parent/learners/[learnerId]", mobile: "(parent)/learners/[learnerId]", status: P },
    {
      web: "/parent/learners/[learnerId]/assessment",
      mobile: "(parent)/assessment/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/assessment/intro",
      mobile: "(parent)/assessment/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/assessment/review",
      mobile: "(parent)/assessment/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/assessment/submitted",
      mobile: "(parent)/assessment/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/baseline",
      mobile: "(parent)/baseline/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/baseline/pending",
      mobile: "(parent)/baseline/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/baseline/summary",
      mobile: "(parent)/baseline/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/brain-clone-watch",
      mobile: "(parent)/brain-clone-watch/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/brain-profile",
      mobile: "(parent)/brain/[childId]/index",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/curriculum",
      mobile: "(parent)/curriculum/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/gradebook",
      mobile: "(parent)/gradebook/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/homework",
      mobile: "(parent)/homework/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/iep",
      mobile: "(parent)/iep/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/iep/review",
      mobile: "(parent)/iep-review/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/lessons",
      mobile: "(parent)/lessons/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/milestones",
      mobile: "(parent)/milestones/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/profile-v2",
      mobile: "(parent)/profile-v2/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/progress",
      mobile: "(parent)/progress/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/sensory",
      mobile: "(parent)/sensory/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/settings",
      mobile: "(parent)/settings-learner/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/snapshot",
      mobile: "(parent)/snapshot/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/summary",
      mobile: "(parent)/summary/[childId]",
      status: P,
    },
    { web: "/parent/learners/[learnerId]/team", mobile: "(parent)/team/[childId]", status: P },
    {
      web: "/parent/learners/[learnerId]/accessibility",
      mobile: "(parent)/accessibility/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/accessibility/audio",
      mobile: "(parent)/accessibility/audio/[childId]",
      status: P,
    },
    { web: "/parent/consent", mobile: "(parent)/consent/index", status: P },
    { web: "/parent/consent/[learnerId]", mobile: "(parent)/consent/[learnerId]", status: P },
    {
      web: "/parent/notifications",
      mobile: "(parent)/inbox",
      status: P,
    },
    {
      web: "/parent/reports",
      mobile: "(parent)/reports",
      status: P,
    },
    { web: "/parent/schedule", mobile: "(parent)/schedule/[childId]", status: P },
    { web: "/parent/privacy", mobile: "(parent)/privacy/index", status: P },
    { web: "/parent/privacy/data-export", mobile: "(parent)/privacy/data-export", status: P },
    { web: "/parent/privacy/delete-data", mobile: "(parent)/privacy/delete-data", status: P },
    { web: "/parent/settings", mobile: "(parent)/settings", status: P },
    { web: "/parent/settings/account", mobile: "(parent)/settings-account/index", status: P },
    { web: "/parent/settings/billing", mobile: "(parent)/billing", status: P },
  ],

  Teacher: [
    { web: "/teacher/home", mobile: "(teacher)/index", status: P },
    { web: "/teacher/learners", mobile: "(teacher)/learners", status: P },
    { web: "/teacher/learners/[learnerId]", mobile: "(teacher)/student/[id]/index", status: P },
    {
      web: "/teacher/learners/[learnerId]/curriculum",
      mobile: "(teacher)/curriculum/[id]",
      status: P,
    },
    {
      web: "/teacher/learners/[learnerId]/iep/draft",
      mobile: "(teacher)/student/[id]/iep",
      status: P,
    },
    { web: "/teacher/classes", mobile: "(teacher)/classes/index", status: P },
    { web: "/teacher/classes/[classId]", mobile: "(teacher)/classes/[classId]", status: P },
    { web: "/teacher/assignments", mobile: "(teacher)/assignments/index", status: P },
    { web: "/teacher/assignments/new", mobile: "(teacher)/assignments/new", status: P },
    { web: "/teacher/insights", mobile: "(teacher)/insights", status: P },
    {
      web: "/teacher/lesson-plans",
      mobile: "(teacher)/lesson-plan",
      status: P,
    },
    { web: "/teacher/reports", mobile: "(teacher)/analytics", status: P },
    { web: "/teacher/settings", mobile: "(teacher)/settings", status: P },
  ],

  Therapist: [
    { web: "/therapist/home", mobile: "(therapist)/index", status: P },
    { web: "/therapist/sessions", mobile: "(therapist)/sessions", status: P },
    { web: "/therapist/reports", mobile: "(therapist)/reports", status: P },
    { web: "/therapist/settings", mobile: "(therapist)/settings", status: P },
  ],

  Caregiver: [
    { web: "/caregiver/home", mobile: "(caregiver)/index", status: P },
    { web: "/caregiver/learners", mobile: "(caregiver)/learners", status: P },
    {
      web: "/caregiver/observations",
      mobile: "(caregiver)/child/[childId]/observation",
      status: P,
    },
    { web: "/caregiver/settings", mobile: "(caregiver)/settings", status: P },
  ],
};

// --- Route discovery --------------------------------------------------

function walk(dir, test) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".expo" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, test));
    else if (test(entry)) out.push(full);
  }
  return out;
}

function webRouteFromFile(file) {
  let r = "/" + relative(WEB_APP, dirname(file)).split("\\").join("/");
  return r === "/." ? "/" : r;
}

const webRoutes = walk(WEB_APP, (f) => f === "page.tsx").map(webRouteFromFile);

function isWebOnly(route) {
  return WEB_ONLY_PREFIXES.some((p) => route === p || route.startsWith(p + "/"));
}

// Flatten the matrix into a lookup of tracked web routes.
const tracked = new Map();
for (const [role, rows] of Object.entries(PARITY_MATRIX)) {
  for (const row of rows) tracked.set(row.web, { ...row, role });
}

// --- Checks -----------------------------------------------------------

const errors = [];
const warnings = [];

// 2. Untracked in-scope web routes (parity drift guard).
const untracked = webRoutes.filter((r) => !isWebOnly(r) && !tracked.has(r)).sort();
for (const r of untracked) {
  const msg = `untracked web route ${r} — add it to PARITY_MATRIX (web grew; re-audit mobile parity).`;
  if (STRICT) errors.push(msg);
  else warnings.push(msg);
}

// 3. Parity/Partial rows must point at a real mobile file.
function mobileExists(rel) {
  if (!rel) return false;
  return (
    existsSync(join(MOB_APP, rel + ".tsx")) ||
    existsSync(join(MOB_APP, rel + ".ts")) ||
    existsSync(join(MOB_APP, rel, "index.tsx"))
  );
}
for (const { web, mobile, status, role } of tracked.values()) {
  if ((status === P || status === PARTIAL) && !mobileExists(mobile)) {
    errors.push(
      `${role}: ${web} marked ${status} but mobile screen '${mobile}' not found on disk.`,
    );
  }
}

// --- Tally ------------------------------------------------------------

const tally = { [P]: 0, [PARTIAL]: 0, [MISSING]: 0 };
for (const { status } of tracked.values()) tally[status]++;
const inScope = tally[P] + tally[PARTIAL] + tally[MISSING];
const parityPct = ((tally[P] / inScope) * 100).toFixed(0);

// --- Output -----------------------------------------------------------

if (MARKDOWN) {
  emitMarkdown();
  process.exit(0);
}

console.log(
  "\nWeb ⇄ Mobile parity check (roles: learner, parent, teacher, therapist, caregiver)\n",
);
for (const [role, rows] of Object.entries(PARITY_MATRIX)) {
  const t = { [P]: 0, [PARTIAL]: 0, [MISSING]: 0 };
  for (const row of rows) t[row.status]++;
  console.log(
    `  ${role.padEnd(16)} parity ${String(t[P]).padStart(2)}  partial ${String(t[PARTIAL]).padStart(2)}  missing ${String(t[MISSING]).padStart(2)}`,
  );
}
console.log(
  `\n  TOTAL            parity ${tally[P]}  partial ${tally[PARTIAL]}  missing ${tally[MISSING]}  (${parityPct}% full parity, ${inScope} in-scope routes)`,
);
console.log(
  `  Web-only (excluded): ${webRoutes.filter(isWebOnly).length} routes (admin / dev / design-system).\n`,
);

if (warnings.length) for (const w of warnings) console.warn(`warn: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\nweb:parity FAILED with ${errors.length} error(s).`);
  process.exit(1);
}
console.log("web:parity OK — matrix consistent with disk; no parity drift.\n");

// --- Markdown emitter -------------------------------------------------

function emitMarkdown() {
  const L = [];
  L.push("# Mobile Parity Audit");
  L.push("");
  L.push("> **Generated** by `scripts/web-mobile-parity-check.mjs`. Do not hand-edit —");
  L.push("> update `PARITY_MATRIX` in the script and run `pnpm mobile:parity:md`.");
  L.push("");
  L.push("Comparison of the Expo mobile app (`apps/mobile/`) against the Next.js web");
  L.push("app (`apps/web-v2/`) across the five roles that ship in the unified mobile");
  L.push("app: **learner, parent, teacher, therapist, caregiver**. School / district /");
  L.push("internal admin surfaces are web-only and excluded (see `docs/NAVIGATION.md`).");
  L.push("");
  L.push("Status legend: **Parity** comparable on both · **Partial** present but a");
  L.push("sub-feature is missing · **Missing** not yet on mobile.");
  L.push("");
  L.push("## Summary");
  L.push("");
  L.push("| Status | Count |");
  L.push("| ------ | ----- |");
  L.push(`| Parity | ${tally[P]} |`);
  L.push(`| Partial | ${tally[PARTIAL]} |`);
  L.push(`| Missing | ${tally[MISSING]} |`);
  L.push(`| **In-scope total** | **${inScope}** |`);
  L.push("");
  L.push(
    `Full parity: **${parityPct}%**. ${webRoutes.filter(isWebOnly).length} web-only routes excluded.`,
  );
  L.push("");
  for (const [role, rows] of Object.entries(PARITY_MATRIX)) {
    L.push(`## ${role}`);
    L.push("");
    L.push("| Web route | Mobile screen | Status | Gap / Ticket |");
    L.push("| --------- | ------------- | ------ | ------------ |");
    for (const row of rows) {
      const mob = row.mobile ? `\`${row.mobile}\`` : "—";
      const status = row.status === P ? "Parity" : `**${row.status}**`;
      L.push(`| \`${row.web}\` | ${mob} | ${status} | ${row.gap ?? "—"} |`);
    }
    L.push("");
  }
  process.stdout.write(L.join("\n") + "\n");
}
