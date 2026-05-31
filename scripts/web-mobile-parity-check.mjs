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
  ],

  Onboarding: [
    {
      web: "/onboarding",
      mobile: null,
      status: MISSING,
      gap: "MOB-ONB-001: onboarding entry/router screen.",
    },
    {
      web: "/onboarding/welcome",
      mobile: null,
      status: MISSING,
      gap: "MOB-ONB-002: brand welcome + sign-in/up entry.",
    },
    {
      web: "/onboarding/role",
      mobile: null,
      status: MISSING,
      gap: "MOB-ONB-003: role selector (parent/teacher).",
    },
    {
      web: "/onboarding/signup",
      mobile: "(auth)/signup",
      status: PARTIAL,
      gap: "MOB-ONB-004: invite-code + footer terms parity with web signup.",
    },
    { web: "/onboarding/signin", mobile: "(auth)/login", status: P },
    {
      web: "/onboarding/terms",
      mobile: null,
      status: MISSING,
      gap: "MOB-ONB-005: terms acceptance screen.",
    },
    {
      web: "/onboarding/privacy",
      mobile: null,
      status: MISSING,
      gap: "MOB-ONB-006: privacy policy + CCPA/GDPR summary screen.",
    },
    {
      web: "/onboarding/consent",
      mobile: "(auth)/consent-sheet",
      status: PARTIAL,
      gap: "MOB-ONB-007: full consent checkboxes (data, analytics, marketing) vs current sheet.",
    },
    { web: "/onboarding/recovery", mobile: "(auth)/forgot-password", status: P },
    { web: "/onboarding/pin", mobile: "(auth)/pin", status: P },
    {
      web: "/onboarding/permissions",
      mobile: null,
      status: MISSING,
      gap: "MOB-ONB-008: device camera/mic/notification permission priming.",
    },
    {
      web: "/onboarding/parent-setup",
      mobile: "(parent)/onboard",
      status: PARTIAL,
      gap: "MOB-ONB-009: learner creation + assessment-intro parity inside onboarding.",
    },
    {
      web: "/onboarding/parent-verify",
      mobile: null,
      status: MISSING,
      gap: "MOB-ONB-010: email/SMS verification step.",
    },
    {
      web: "/onboarding/iep-upload",
      mobile: null,
      status: MISSING,
      gap: "MOB-ONB-011: IEP PDF upload + extraction (expo-document-picker).",
    },
    {
      web: "/onboarding/child-approval",
      mobile: null,
      status: MISSING,
      gap: "MOB-ONB-012: parent approves child profile before activation.",
    },
    {
      web: "/onboarding/learner/new",
      mobile: null,
      status: MISSING,
      gap: "MOB-ONB-013: learner self-signup form.",
    },
    {
      web: "/onboarding/error",
      mobile: null,
      status: MISSING,
      gap: "MOB-ONB-014: onboarding error/recovery fallback screen.",
    },
  ],

  Learner: [
    { web: "/learner/home", mobile: "(learner)/index", status: P },
    {
      web: "/learner/select",
      mobile: "(auth)/session-switch",
      status: PARTIAL,
      gap: "MOB-LRN-001: multi-learner picker / active-learner selection on the learner surface.",
    },
    {
      web: "/learner/subjects",
      mobile: null,
      status: MISSING,
      gap: "MOB-LRN-002: subjects grid with mastery progress + baseline gating.",
    },
    {
      web: "/learner/subjects/[subjectId]",
      mobile: null,
      status: MISSING,
      gap: "MOB-LRN-003: subject detail (tutor hero, next-up, skill path, mastery grid).",
    },
    { web: "/learner/baseline", mobile: null, status: MISSING, gap: "MOB-LRN-004: baseline hub." },
    {
      web: "/learner/baseline/intro",
      mobile: null,
      status: MISSING,
      gap: "MOB-LRN-004: baseline intro (question count, subjects, time).",
    },
    {
      web: "/learner/baseline/why",
      mobile: null,
      status: MISSING,
      gap: "MOB-LRN-004: baseline 'why' reassurance screen.",
    },
    {
      web: "/learner/baseline/readiness",
      mobile: null,
      status: MISSING,
      gap: "MOB-LRN-004: 4-check readiness pre-flight.",
    },
    {
      web: "/learner/baseline/subjects",
      mobile: null,
      status: MISSING,
      gap: "MOB-LRN-004: baseline subject multi-select.",
    },
    {
      web: "/learner/baseline/[baselineId]",
      mobile: null,
      status: MISSING,
      gap: "MOB-LRN-005: adaptive baseline RUNNER (IRT/streaming, breaks, supports, completion hero).",
    },
    {
      web: "/learner/library",
      mobile: null,
      status: MISSING,
      gap: "MOB-LRN-006: completed-lessons replay library.",
    },
    {
      web: "/learner/lesson-runs/[lessonRunId]",
      mobile: "(learner)/stage/[sessionId]",
      status: PARTIAL,
      gap: "MOB-LRN-007: lesson-run HOST states (generating/failed/ready) + lessons list around the stage runtime.",
    },
    {
      web: "/learner/missions",
      mobile: null,
      status: MISSING,
      gap: "MOB-LRN-008: assignments + in-progress lessons ('missions') screen.",
    },
    { web: "/learner/quests", mobile: "(learner)/quests/index", status: P },
    { web: "/learner/quests/[worldId]", mobile: "(learner)/quests/[worldSlug]/index", status: P },
    {
      web: "/learner/quests/[worldId]/chapters/[chapterId]",
      mobile: "(learner)/quests/[worldSlug]/play/[questId]",
      status: PARTIAL,
      gap: "MOB-LRN-009: chapter-level quest navigation parity.",
    },
    {
      web: "/learner/progress",
      mobile: null,
      status: MISSING,
      gap: "MOB-LRN-010: premium progress charts (mastery %, trend, heatstrips, recent activity).",
    },
    {
      web: "/learner/rewards",
      mobile: "(learner)/badges",
      status: PARTIAL,
      gap: "MOB-LRN-011: quest-world/sticker-book rewards parity (mobile splits across badges/shop).",
    },
    {
      web: "/learner/notifications",
      mobile: null,
      status: MISSING,
      gap: "MOB-LRN-012: learner notifications (SSE + polling).",
    },
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
      status: PARTIAL,
      gap: "MOB-LRN-015: learner brain-clone view parity (mobile brain screen lacks clone build/XAI annotations).",
    },
  ],

  Parent: [
    { web: "/parent/home", mobile: "(parent)/index", status: P },
    { web: "/parent/home-v2", mobile: "(parent)/home-v2", status: P },
    {
      web: "/parent/learners",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-001: parent learners LIST area (mobile only shows children inline on home).",
    },
    {
      web: "/parent/learners/new",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-002: add-learner form (district lookup, AI strength suggestions).",
    },
    {
      web: "/parent/learners/[learnerId]",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-003: learner profile hub (quick-access + exploration grid + profile basics).",
    },
    {
      web: "/parent/learners/[learnerId]/assessment",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-004: parent assessment wizard (17+ steps, autosave, AI suggestions).",
    },
    {
      web: "/parent/learners/[learnerId]/assessment/intro",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-004: assessment intro.",
    },
    {
      web: "/parent/learners/[learnerId]/assessment/review",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-004: assessment review.",
    },
    {
      web: "/parent/learners/[learnerId]/assessment/submitted",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-004: assessment submitted confirmation.",
    },
    {
      web: "/parent/learners/[learnerId]/baseline",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-005: parent baseline status + start/restart.",
    },
    {
      web: "/parent/learners/[learnerId]/baseline/pending",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-005: baseline pending state.",
    },
    {
      web: "/parent/learners/[learnerId]/baseline/summary",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-005: baseline summary.",
    },
    {
      web: "/parent/learners/[learnerId]/brain-clone-watch",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-006: brain-clone build/approval cinematic (mobile-only parents cannot approve today).",
    },
    {
      web: "/parent/learners/[learnerId]/brain-profile",
      mobile: "(parent)/brain/[childId]/index",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/curriculum",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-007: upload school curriculum (CurriculumManager).",
    },
    {
      web: "/parent/learners/[learnerId]/gradebook",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-008: parent gradebook (subject averages, per-skill table, recent runs).",
    },
    {
      web: "/parent/learners/[learnerId]/homework",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-009: parent homework summary view.",
    },
    {
      web: "/parent/learners/[learnerId]/iep",
      mobile: "(parent)/iep/[childId]",
      status: PARTIAL,
      gap: "MOB-PAR-010: IEP review sub-flow parity.",
    },
    {
      web: "/parent/learners/[learnerId]/iep/review",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-010: IEP review screen.",
    },
    {
      web: "/parent/learners/[learnerId]/lessons",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-011: plain-language per-lesson recaps.",
    },
    {
      web: "/parent/learners/[learnerId]/milestones",
      mobile: "(parent)/milestones/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/profile-v2",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-012: profile-v2 metric hub.",
    },
    {
      web: "/parent/learners/[learnerId]/progress",
      mobile: "(parent)/progress/[childId]",
      status: P,
    },
    {
      web: "/parent/learners/[learnerId]/sensory",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-013: sensory profile (5 modality cards).",
    },
    {
      web: "/parent/learners/[learnerId]/settings",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-014: per-learner settings + delete learner.",
    },
    {
      web: "/parent/learners/[learnerId]/snapshot",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-015: weekly one-glance snapshot.",
    },
    {
      web: "/parent/learners/[learnerId]/summary",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-016: learner overall summary.",
    },
    { web: "/parent/learners/[learnerId]/team", mobile: "(parent)/team/[childId]", status: P },
    {
      web: "/parent/learners/[learnerId]/accessibility",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-017: per-learner accessibility form.",
    },
    {
      web: "/parent/learners/[learnerId]/accessibility/audio",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-017: per-learner audio prefs.",
    },
    {
      web: "/parent/consent",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-018: ongoing consent/approvals center (account-level).",
    },
    {
      web: "/parent/consent/[learnerId]",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-018: per-learner consent (COPPA notice).",
    },
    {
      web: "/parent/notifications",
      mobile: "(parent)/inbox",
      status: PARTIAL,
      gap: "MOB-PAR-019: notifications parity (read state, live stream) vs current inbox.",
    },
    {
      web: "/parent/reports",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-020: parent reports (weekly metrics + recaps per learner).",
    },
    {
      web: "/parent/schedule",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-021: parent schedule (assignments + active lessons).",
    },
    { web: "/parent/privacy", mobile: null, status: MISSING, gap: "MOB-PAR-022: privacy hub." },
    {
      web: "/parent/privacy/data-export",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-022: data export request.",
    },
    {
      web: "/parent/privacy/delete-data",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-022: data deletion request.",
    },
    { web: "/parent/settings", mobile: "(parent)/settings", status: P },
    {
      web: "/parent/settings/account",
      mobile: null,
      status: MISSING,
      gap: "MOB-PAR-023: account settings sub-screen (display name etc.).",
    },
    { web: "/parent/settings/billing", mobile: "(parent)/billing", status: P },
  ],

  Teacher: [
    { web: "/teacher/home", mobile: "(teacher)/index", status: P },
    {
      web: "/teacher/learners",
      mobile: null,
      status: MISSING,
      gap: "MOB-TCH-001: teacher roster/learners LIST.",
    },
    { web: "/teacher/learners/[learnerId]", mobile: "(teacher)/student/[id]/index", status: P },
    {
      web: "/teacher/learners/[learnerId]/curriculum",
      mobile: null,
      status: MISSING,
      gap: "MOB-TCH-002: teacher curriculum manager.",
    },
    {
      web: "/teacher/learners/[learnerId]/iep/draft",
      mobile: "(teacher)/student/[id]/iep",
      status: PARTIAL,
      gap: "MOB-TCH-003: AI SMART-goal IEP draft generation parity.",
    },
    { web: "/teacher/classes", mobile: null, status: MISSING, gap: "MOB-TCH-004: classes list." },
    {
      web: "/teacher/classes/[classId]",
      mobile: null,
      status: MISSING,
      gap: "MOB-TCH-005: class detail (roster).",
    },
    {
      web: "/teacher/assignments",
      mobile: null,
      status: MISSING,
      gap: "MOB-TCH-006: assignments list.",
    },
    {
      web: "/teacher/assignments/new",
      mobile: null,
      status: MISSING,
      gap: "MOB-TCH-007: create assignment.",
    },
    {
      web: "/teacher/insights",
      mobile: "(teacher)/student/[id]/insight",
      status: PARTIAL,
      gap: "MOB-TCH-008: class-wide insights list (mobile is per-student only).",
    },
    {
      web: "/teacher/lesson-plans",
      mobile: "(teacher)/lesson-plan",
      status: PARTIAL,
      gap: "MOB-TCH-009: lesson-plan LIBRARY/list (mobile is single-plan editor).",
    },
    {
      web: "/teacher/reports",
      mobile: "(teacher)/analytics",
      status: PARTIAL,
      gap: "MOB-TCH-010: classroom mastery-distribution reports parity.",
    },
    { web: "/teacher/settings", mobile: "(teacher)/settings", status: P },
  ],

  Therapist: [
    { web: "/therapist/home", mobile: "(therapist)/index", status: P },
    { web: "/therapist/sessions", mobile: "(therapist)/sessions", status: P },
    {
      web: "/therapist/reports",
      mobile: "(therapist)/client/[id]/reports",
      status: PARTIAL,
      gap: "MOB-THR-001: cross-client reports roll-up (mobile is per-client).",
    },
    { web: "/therapist/settings", mobile: "(therapist)/settings", status: P },
  ],

  Caregiver: [
    { web: "/caregiver/home", mobile: "(caregiver)/index", status: P },
    {
      web: "/caregiver/learners",
      mobile: null,
      status: MISSING,
      gap: "MOB-CGV-001: caregiver learners list (mobile drills in via child/[id]).",
    },
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
