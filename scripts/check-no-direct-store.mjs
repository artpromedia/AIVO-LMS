#!/usr/bin/env node
/**
 * check-no-direct-store.mjs — persistence migration guardrail (Sprint 0).
 *
 * Once a domain has been migrated to `getPersistence()`, no production code
 * path for that domain may reach back into the in-memory Map store. This
 * gate fails when a *migrated* domain's code:
 *
 *   - imports `getStore` / `resetStore` from `@/lib/db/store`, or
 *   - calls `db()` (the `ensureSeeded(); return getStore()` shim in repos.ts).
 *
 * Scope is driven by the `MIGRATED_DOMAINS` allowlist below. Each sprint that
 * migrates a domain APPENDS an entry naming:
 *
 *   - `appPaths`: route/page globs under `apps/web-v2/app/**` that now go
 *     through the adapter (whole-file scan), and
 *   - `reposFunctions`: exported function names in `apps/web-v2/lib/db/repos.ts`
 *     that were refactored onto `getPersistence()` (per-function body scan).
 *
 * The allowlist starts EMPTY — this sprint only lays the rail. With no
 * migrated domains the gate is a green no-op; it begins enforcing the moment
 * Sprint 1+ adds entries. `getStore`/`resetStore` remain legal everywhere a
 * domain has NOT yet been migrated (and in tests), so nothing breaks today.
 *
 * Exit non-zero with `file:line` for every offending occurrence.
 *
 * Usage: node scripts/check-no-direct-store.mjs
 */
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const WEB_V2 = join(ROOT, "apps", "web-v2");
const APP_DIR = join(WEB_V2, "app");
const REPOS = join(WEB_V2, "lib", "db", "repos.ts");

/**
 * @typedef {Object} MigratedDomain
 * @property {string} domain            Human-readable domain key.
 * @property {string[]} [appPaths]      Paths under apps/web-v2/app (file or
 *                                       dir, relative to apps/web-v2/app).
 *                                       A directory is scanned recursively.
 * @property {string[]} [reposFunctions] Exported repos.ts function names whose
 *                                        bodies must be free of getStore/db().
 */

/** @type {MigratedDomain[]} */
const MIGRATED_DOMAINS = [
  // Sprint 1 — the 12 originally-migrated domains, proven on Postgres via the
  // parity harness. Their migrated repos.ts entrypoints are locked clean here
  // so a regression that reaches back into the Map store fails CI. (Page
  // components that still read the store across several domains are a separate
  // presentation-layer cleanup tracked for a later sprint; only verified-clean
  // surfaces are listed.)
  {
    domain: "notifications",
    reposFunctions: [
      "createNotification",
      "listNotifications",
      "markNotificationsRead",
      "listDeliveriesFor",
    ],
  },
  {
    domain: "audit",
    reposFunctions: ["recordAudit", "recentAuditLogs", "listAuditLogsForTenants"],
  },
  {
    domain: "identity",
    appPaths: ["api/bff/account", "parent/settings/account"],
    reposFunctions: [
      "getUserById",
      "listUsersForTenants",
      "addStaffUser",
      "removeStaffUser",
      "updateUserDisplayName",
    ],
  },
  {
    domain: "learners",
    reposFunctions: [
      "createLearner",
      "getLearner",
      "listLearnersForParent",
      "parentCanAccessLearner",
      "updateLearner",
      "deleteLearner",
      "findPrimaryParentForLearner",
    ],
  },
  {
    domain: "assessments",
    reposFunctions: [
      "getOrCreateParentAssessment",
      "findParentAssessment",
      "submitParentAssessment",
      "patchParentAssessmentSection",
    ],
  },
  {
    domain: "lessonRuns",
    reposFunctions: ["getLessonRun", "listLessonRunsForLearner"],
  },
  {
    domain: "brainProfiles",
    reposFunctions: ["getBrainProfile", "upsertBrainProfile"],
  },
  {
    domain: "curriculum",
    reposFunctions: ["listSubjects", "getSubjectById", "listSkills", "getSkill"],
  },
  {
    domain: "compliance",
    reposFunctions: [
      "getActiveConsentForUser",
      "listConsentsForUser",
      "listSubprocessors",
      "listPolicyVersions",
      // Sprint 5 — privacy / DSAR / terms extension.
      "listConsentVersions",
      "getActiveConsentVersion",
      "recordTermsAcceptance",
      "listDataInventory",
      "listRetentionPolicies",
      "getRetentionPolicy",
      "updateRetentionPolicy",
      "recordDisclosure",
      "listDisclosures",
      "createDataExportRequest",
      "getDataExportRequest",
      "getDataExportRequestById",
      "listDataExportRequestsForUser",
      "listAllDataExportRequests",
      "updateDataExportRequestStatus",
      "createDataDeletionRequest",
      "getDataDeletionRequest",
      "getDataDeletionRequestById",
      "listDataDeletionRequestsForUser",
      "listAllDataDeletionRequests",
      "logIepAccess",
      "listIepAccessForLearner",
    ],
  },
  {
    domain: "quests",
    reposFunctions: ["listQuestWorlds", "listQuestChapters"],
  },
  {
    domain: "admin",
    reposFunctions: ["listSchools", "getSchool", "listClassrooms", "getClassroom"],
  },
  {
    domain: "collaboration",
    reposFunctions: ["setTeamInviteDecision"],
  },
  // Sprint 2 — web-owned billing / AI-cost / coupon / batch rows now durable
  // in web_* tables (canonical subs/invoices/seats stay in billing-svc, ADR
  // 0015). Migration jobs (the cross-domain mock admin runner) are a later
  // sprint and intentionally not listed.
  {
    domain: "billing",
    appPaths: ["api/bff/admin/ai-budgets", "api/bff/admin/billing"],
    reposFunctions: [
      "getBillingForTenant",
      "listBillingForTenants",
      "getAIBudget",
      "updateAIBudget",
      "monthToDateSpendCents",
      "checkAIBudget",
      "recordAICostEvent",
      "listAICostEvents",
      "listCoupons",
      "listDailyBillingBatches",
    ],
  },
  // Sprint 3 — web-owned IEP AI-draft review inbox (web_iep_ai_drafts).
  // Canonical IEP goals / therapist notes / caregiver observations stay in
  // family-svc (ADR 0015, lib/clinical/family-svc-client.ts) and are not
  // web_* migration targets, so they are intentionally not listed here.
  {
    domain: "clinical",
    reposFunctions: [
      "upsertIepAiDraft",
      "getIepAiDraft",
      "listIepAiDraftsForReviewer",
      "progressIepAiDraft",
    ],
  },
  // Sprint 4 — platform-global security / SOC 2 / incident / vendor /
  // privacy-matrix / vulnerability artifacts (web_* tables, no RLS).
  {
    domain: "security",
    appPaths: ["api/bff/admin/security"],
    reposFunctions: [
      "listSecurityControls",
      "getSecurityControl",
      "createSecurityControl",
      "updateSecurityControl",
      "listEvidenceForControl",
      "createControlEvidence",
      "listRisks",
      "createRisk",
      "updateRisk",
      "listIncidents",
      "getIncident",
      "createIncident",
      "updateIncident",
      "appendIncidentTimeline",
      "listIncidentTimeline",
      "listVendors",
      "createVendor",
      "updateVendor",
      "listStatePrivacyRequirements",
      "listStatePrivacyMappingsFor",
      "createStatePrivacyMapping",
      "updateStatePrivacyMapping",
      "listVulnerabilities",
      "createVulnerability",
      "updateVulnerability",
    ],
  },
];

// Forbidden signals. `getStore`/`resetStore` as identifiers; `db()` as a call.
const IMPORT_RE = /\b(getStore|resetStore)\b/;
const DB_CALL_RE = /\bdb\(\)/;

const violations = [];

function addViolation(file, line, snippet, why) {
  violations.push({ file: relative(ROOT, file), line, snippet: snippet.trim(), why });
}

/** Recursively collect *.ts / *.tsx files under a path (or the file itself). */
function collectFiles(absPath) {
  if (!existsSync(absPath)) return [];
  const st = statSync(absPath);
  if (st.isFile()) return /\.tsx?$/.test(absPath) ? [absPath] : [];
  const out = [];
  for (const entry of readdirSync(absPath, { withFileTypes: true })) {
    const child = join(absPath, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(child));
    else if (entry.isFile() && /\.tsx?$/.test(entry.name)) out.push(child);
  }
  return out;
}

/** Scan a whole file for forbidden patterns. */
function scanFile(absPath) {
  const src = readFileSync(absPath, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) return;
    if (IMPORT_RE.test(line)) addViolation(absPath, i + 1, line, "references getStore/resetStore");
    if (DB_CALL_RE.test(line)) addViolation(absPath, i + 1, line, "calls db()");
  });
}

/**
 * Extract the brace-matched body of an exported function by name from a
 * source string. Returns `{ startLine, body }` or null if not found.
 */
function extractFunction(src, name) {
  const re = new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\s*[(<]`);
  const m = re.exec(src);
  if (!m) return null;
  // Find the first `{` after the signature, then brace-match.
  let i = src.indexOf("{", m.index);
  if (i < 0) return null;
  const bodyStart = i;
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  const body = src.slice(bodyStart, i);
  const startLine = src.slice(0, bodyStart).split("\n").length;
  return { startLine, body };
}

/** Scan named repos.ts functions for forbidden patterns. */
function scanReposFunctions(names) {
  if (names.length === 0) return;
  if (!existsSync(REPOS)) {
    violations.push({ file: relative(ROOT, REPOS), line: 0, snippet: "", why: "repos.ts missing" });
    return;
  }
  const src = readFileSync(REPOS, "utf8");
  for (const name of names) {
    const fn = extractFunction(src, name);
    if (!fn) {
      violations.push({
        file: relative(ROOT, REPOS),
        line: 0,
        snippet: name,
        why: `migrated function "${name}" not found in repos.ts`,
      });
      continue;
    }
    fn.body.split("\n").forEach((line, idx) => {
      if (IMPORT_RE.test(line)) {
        addViolation(REPOS, fn.startLine + idx, line, `getStore/resetStore in ${name}()`);
      }
      if (DB_CALL_RE.test(line)) {
        addViolation(REPOS, fn.startLine + idx, line, `db() in ${name}()`);
      }
    });
  }
}

for (const d of MIGRATED_DOMAINS) {
  for (const p of d.appPaths ?? []) {
    const abs = resolve(APP_DIR, p);
    for (const f of collectFiles(abs)) scanFile(f);
  }
  scanReposFunctions(d.reposFunctions ?? []);
}

const enforced = MIGRATED_DOMAINS.map((d) => d.domain).join(", ") || "(none yet)";
console.log(`check-no-direct-store — enforcing ${MIGRATED_DOMAINS.length} domain(s): ${enforced}`);

if (violations.length > 0) {
  console.error("\n✖ Direct in-memory store access in migrated production code:");
  for (const v of violations) {
    const loc = v.line ? `${v.file}:${v.line}` : v.file;
    console.error(`  - ${loc} — ${v.why}${v.snippet ? `  »  ${v.snippet}` : ""}`);
  }
  console.error(
    `\nMigrated domains must go through getPersistence(). Remove the getStore/` +
      `db() access above, or (if the domain is not actually migrated) drop it ` +
      `from MIGRATED_DOMAINS in scripts/check-no-direct-store.mjs.`,
  );
  process.exit(1);
}

console.log("✓ no direct store access in migrated domains (clean).");
