#!/usr/bin/env node
/**
 * Structural production-gap gate.
 *
 * Locks in the high-risk implementation floors that are easy to regress:
 * durable authority state, fail-closed learner scoring, immutable evidence,
 * and complete agentic PRE-K-12 tutor declarations backed by seeded packs.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

// Honest-coverage handshake (remediation Sprint 01): the per-band item
// counts come from the SAME compiled @aivo/item-bank module the
// curriculum:coverage promotion guard uses, so the two gates can never
// disagree about whether a band has real content behind it.
const itemBankDist = join(repoRoot, "packages/item-bank/dist/index.js");
if (!existsSync(itemBankDist)) {
  execSync("corepack pnpm --filter @aivo/item-bank build", { cwd: repoRoot, stdio: "inherit" });
}
const itemBank = await import(pathToFileURL(itemBankDist).href);
/** Mirror of MIN_AUTHORED_ITEMS_PER_BAND in scripts/curriculum-coverage-check.mjs. */
const MIN_AUTHORED_ITEMS_PER_BAND = 3;

function read(rel) {
  const abs = resolve(repoRoot, rel);
  if (!existsSync(abs)) {
    errors.push(`${rel}: required production implementation file is missing`);
    return "";
  }
  return readFileSync(abs, "utf8");
}

function requirePatterns(rel, patterns) {
  const source = read(rel);
  for (const [label, pattern] of patterns) {
    if (!pattern.test(source)) errors.push(`${rel}: missing ${label}`);
  }
}

requirePatterns("services/status-page-svc/src/index.ts", [
  ["production DATABASE_URL guard", /DATABASE_URL is required in production/],
  ["durable store hydration", /hydrateStatusStore/],
  ["durable store persistence", /persistStatusStore/],
]);
requirePatterns("services/status-page-svc/src/statuspage/persistence.ts", [
  ["database-backed runtime state", /serviceRuntimeState/],
  ["empty production bootstrap", /createEmptyStatusStore/],
]);
requirePatterns("services/tenant-svc/src/server.ts", [
  ["production DATABASE_URL guard", /DATABASE_URL is required in production/],
  ["database passed to tenant routes", /registerDistrictRoutes\(app,\s*db\)/],
]);
requirePatterns("services/tenant-svc/src/persistence.ts", [
  ["durable district tables", /tenantServiceDistricts/],
  ["transactional roster persistence", /importRosterPersistent/],
]);
requirePatterns("services/homework-svc/src/lib/session-store.ts", [
  ["persisted homework runtime state", /runtimeState/],
  ["production persistence failure guard", /NODE_ENV === "production"/],
]);
requirePatterns("apps/web-v2/lib/offline/idempotency.ts", [
  ["durable idempotency table", /idempotencyKeys/],
  ["production postgres selection", /NODE_ENV === "production"/],
]);
requirePatterns("services/speech-eval-svc/src/index.ts", [
  ["production live-mode guard", /SPEECH_EVAL_MODE=live is required in production/],
  ["production ASR provider guard", /configured ASR_PROVIDER with valid credentials is required/],
]);
requirePatterns("services/speech-eval-svc/src/routes/evaluate.ts", [
  ["fail-closed ASR response", /reply\.code\(503\)/],
]);
requirePatterns("services/admin-svc/src/lib/soc2-evidence.ts", [
  ["S3 Object Lock compliance mode", /ObjectLockMode:\s*"COMPLIANCE"/],
  ["evidence checksum", /ChecksumSHA256/],
  ["production WORM bucket guard", /EVIDENCE_S3_BUCKET is required in production/],
]);
requirePatterns("services/ai-svc/src/ai_svc/speech_buddy/encryption.py", [
  ["production master-key guard", /SPEECH_BUDDY_TRANSCRIPT_MASTER_KEY.*required in production/s],
  ["production AES-GCM guard", /AESGCM is required for Speech Buddy transcripts in production/],
  ["production dev-cipher rejection", /XOR-HMAC-DEV transcripts are forbidden in production/],
]);

const seedDir = resolve(repoRoot, "packages/content-pack/src/seeds");
const seededPackIds = new Set();
for (const file of readdirSync(seedDir).filter((name) => name.endsWith(".ts"))) {
  const source = readFileSync(join(seedDir, file), "utf8");
  for (const match of source.matchAll(/\bid:\s*"([^"]+-fall-2026)"/g)) seededPackIds.add(match[1]);
}

const tutorDir = resolve(repoRoot, "services/tutor-svc/src/modes");
const tutorFiles = readdirSync(tutorDir).filter((name) => name.endsWith("Tutor.ts"));
for (const file of tutorFiles) {
  const rel = `services/tutor-svc/src/modes/${file}`;
  const source = read(rel);
  if (!/capabilities:\s*\[[^\]]*"agentic_guidance"/s.test(source)) {
    errors.push(`${rel}: tutor is missing agentic_guidance`);
  }
  if (!/gradeBands:\s*\[[^\]]*"PRE_K"/s.test(source)) {
    errors.push(`${rel}: tutor is missing PRE_K scope`);
  }
  if (/:\s*"missing"/.test(source)) {
    errors.push(`${rel}: coverage matrix contains missing bands`);
  }
  // Honest coverage (remediation Sprint 01): curriculum:coverage forbids
  // "authored" bands without ≥3 real production items + a signed non-draft
  // graph, so "scaffold" is the EXPECTED, honest state for bands whose
  // content the curriculum team has not authored yet — demanding
  // authored-everywhere here would only reward inflated matrices. What this
  // gate still refuses is the inverse gap: a band whose item bank IS deep
  // enough but that someone left scaffold without an explicit decision.
  // Deliberately holding ready content back from production requires an
  // owner attestation marker
  // (production-gap-gate:allow-scaffold(BAND) owner=… date=…).
  const attestedBands = new Set(
    [...source.matchAll(
      /production-gap-gate:allow-scaffold\((\w+)\)\s+owner=\S+\s+date=\d{4}-\d{2}-\d{2}/g,
    )].map((match) => match[1]),
  );
  const tutorSubjects = [
    ...(source.match(/subjects:\s*\[([^\]]*)\]/s)?.[1] ?? "").matchAll(/"([^"]+)"/g),
  ].map((m) => m[1]);
  let hasScaffoldBand = false;
  for (const match of source.matchAll(/\b(\w+|"\d+"):\s*"scaffold"/g)) {
    const band = match[1].replaceAll('"', "");
    hasScaffoldBand = true;
    if (attestedBands.has(band)) continue;
    const bandItems = tutorSubjects.reduce(
      (sum, subject) => sum + itemBank.countAuthoredItems(subject, band),
      0,
    );
    if (bandItems >= MIN_AUTHORED_ITEMS_PER_BAND) {
      errors.push(
        `${rel}: coverage matrix band ${band} is scaffold despite ${bandItems} production ` +
          `item(s) backing it — promote it to authored (and pass curriculum:coverage) or add ` +
          `an allow-scaffold owner attestation recording the hold-back decision`,
      );
    }
  }
  if (hasScaffoldBand) {
    // The runtime refusal an honest scaffold relies on must stay in place:
    // planSession refuses non-authored bands in production unless the caller
    // opts into preview mode (AIVO_ALLOW_SCAFFOLD_CONTENT).
    requirePatterns("services/tutor-svc/src/lib/learnerContext.ts", [
      ["scaffold preview opt-in guard", /AIVO_ALLOW_SCAFFOLD_CONTENT/],
    ]);
    requirePatterns("services/tutor-svc/tests/tutor-session-route.test.ts", [
      ["scaffold refusal regression test", /scaffold/],
    ]);
  }
  if (!/status:\s*"production"/.test(source)) {
    errors.push(`${rel}: authoring status is not production`);
  }
  const packRefs = source.match(/defaultContentPackRefs:\s*\[([^\]]*)\]/s)?.[1] ?? "";
  const refs = [...packRefs.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  if (refs.length === 0) errors.push(`${rel}: tutor has no default content pack`);
  for (const ref of refs) {
    if (!seededPackIds.has(ref)) errors.push(`${rel}: default content pack "${ref}" is not seeded`);
  }
}

if (errors.length > 0) {
  console.error(`production-gap-gate: FAIL (${errors.length} finding(s))`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(
  `production-gap-gate: OK (${tutorFiles.length} agentic tutors, ${seededPackIds.size} seeded packs).`,
);
