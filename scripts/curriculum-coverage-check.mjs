#!/usr/bin/env node
// curriculum:coverage — Sprint GREEN-03 gate.
//
// `curriculum:validate` is a structural check (every seed exported, every
// item has a skillId, etc.). This gate is the *coverage* check: it
// enforces that the seeded data actually spans the K-8 production scope
// the sprint requires.
//
// Required coverage (from sprint prompt):
//   - Math K-8 starter graph
//   - Reading/ELA K-8 starter graph
//   - Science K-8 starter graph
//   - Writing K-8 starter graph
//
// Reality at time of authoring (verified via repo inspection):
//   - Math: K only (17 skills)
//   - ELA: K only (6 skills)
//   - Science: K-2 Physical Science + 3-5 Engineering Design
//   - Writing: not separately seeded; folded into ELA pack
//   - Item bank: empty (no seeded items at all)
//
// This script will therefore fail RED until GREEN-03 actually seeds the
// missing grade bands. That is the correct signal — silencing it would
// violate the no-fake-progress rule.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// Subjects → required grade bands (lowercase canonical).
// Grade bands are matched as substring tokens against seed `gradeBand`
// declarations so a seed that declares `gradeBand: "K-2"` covers K, 1, 2.
const REQUIRED_COVERAGE = {
  math: ["K", "1", "2", "3", "4", "5", "6", "7", "8"],
  ela: ["K", "1", "2", "3", "4", "5", "6", "7", "8"],
  science: ["K", "1", "2", "3", "4", "5", "6", "7", "8"],
  writing: ["K", "1", "2", "3", "4", "5", "6", "7", "8"],
};

const MIN_ITEMS_PER_SUBJECT = 20; // a smoke threshold — full requirement is
// much higher but this catches the
// current empty-item-bank state.

// ---------------------------------------------------------------------------
// 1. Walk every seed file in packages/skill-graphs/src/seeds/* and collect
//    (subject, gradeBand) declarations from skill literals.
// ---------------------------------------------------------------------------

const seedsDir = join(repoRoot, "packages/skill-graphs/src/seeds");
const seedFiles = existsSync(seedsDir)
  ? readdirSync(seedsDir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  : [];

const coverage = new Map(); // subject → Set<grade>
function record(subject, gradeBand) {
  if (!subject || !gradeBand) return;
  const subj = subject.toLowerCase();
  // Normalize gradeBand: "K-2" → ["K","1","2"]; "3-5" → ["3","4","5"]; "K" → ["K"]; "6+" → ["6","7","8"]
  const grades = expandGradeBand(gradeBand);
  if (!coverage.has(subj)) coverage.set(subj, new Set());
  for (const g of grades) coverage.get(subj).add(g);
}
function expandGradeBand(band) {
  if (!band) return [];
  const b = band.trim();
  if (/^K$/i.test(b)) return ["K"];
  const range = b.match(/^(K|\d+)\s*-\s*(\d+)$/i);
  if (range) {
    const start = range[1].toUpperCase() === "K" ? 0 : Number(range[1]);
    const end = Number(range[2]);
    const out = [];
    for (let i = start; i <= end; i++) out.push(i === 0 ? "K" : String(i));
    return out;
  }
  const plus = b.match(/^(\d+)\+$/);
  if (plus) {
    const start = Number(plus[1]);
    const out = [];
    for (let i = start; i <= 8; i++) out.push(String(i));
    return out;
  }
  if (/^\d+$/.test(b)) return [b];
  return [];
}

for (const file of seedFiles) {
  const src = readFileSync(join(seedsDir, file), "utf8");
  // Per-graph subject + gradeBand
  const graphSubject = (src.match(/^\s*subject:\s*"([^"]+)"/m) || [])[1];
  const graphGrade = (src.match(/^\s*gradeBand:\s*"([^"]+)"/m) || [])[1];
  // Per-skill subject + gradeBand (override)
  const skillRe = /\{\s*id:\s*"([^"]+)"[\s\S]*?subject:\s*"([^"]+)"[\s\S]*?gradeBand:\s*"([^"]+)"/g;
  let any = false;
  for (const m of src.matchAll(skillRe)) {
    record(m[2], m[3]);
    any = true;
  }
  if (!any && graphSubject && graphGrade) {
    record(graphSubject, graphGrade);
  }
}

// ---------------------------------------------------------------------------
// 2. Item bank: count items per inferred subject (via skillId prefix)
// ---------------------------------------------------------------------------

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile()) out.push(full);
  }
  return out;
}

const itemBankSrc = join(repoRoot, "packages/item-bank/src");
const itemFiles = walk(itemBankSrc).filter(
  (p) =>
    p.endsWith(".ts") &&
    !p.includes("__tests__") &&
    !p.endsWith("/index.ts") &&
    !p.endsWith("/types.ts") &&
    !p.endsWith("/routing.ts") &&
    !p.endsWith("/validate.ts"),
);
const itemCountsBySubject = new Map();
for (const file of itemFiles) {
  const src = readFileSync(file, "utf8");
  const itemRe = /\{\s*id:\s*"([^"]+)"[\s\S]*?skillId:\s*"([^"]+)"/g;
  for (const m of src.matchAll(itemRe)) {
    const skillId = m[2];
    // skillId looks like "ccss-math.K.CC.A.1" or "ccss-ela.K..." etc.
    let subject = "unknown";
    if (/math/i.test(skillId)) subject = "math";
    else if (/ela|reading/i.test(skillId)) subject = "ela";
    else if (/science|ngss/i.test(skillId)) subject = "science";
    else if (/writing/i.test(skillId)) subject = "writing";
    itemCountsBySubject.set(subject, (itemCountsBySubject.get(subject) ?? 0) + 1);
  }
}

// ---------------------------------------------------------------------------
// 3. Report
// ---------------------------------------------------------------------------

const errors = [];
const warnings = [];

console.log("\nCURRICULUM COVERAGE MATRIX\n");
const subjects = Object.keys(REQUIRED_COVERAGE);
const grades = REQUIRED_COVERAGE.math;
const header = ["subject"].concat(grades).concat(["items"]);
console.log(header.map((h) => h.padEnd(8)).join(""));
console.log("-".repeat(header.length * 8));
for (const subj of subjects) {
  const have = coverage.get(subj) ?? new Set();
  const cells = grades.map((g) => (have.has(g) ? "ok" : "—").padEnd(8));
  const items = itemCountsBySubject.get(subj) ?? 0;
  console.log(subj.padEnd(8) + cells.join("") + String(items).padEnd(8));

  const missing = grades.filter((g) => !have.has(g));
  if (missing.length === grades.length) {
    errors.push(`${subj}: no seeded skills for any grade band (K-8)`);
  } else if (missing.length) {
    errors.push(`${subj}: missing grade bands: ${missing.join(", ")}`);
  }
  if (items < MIN_ITEMS_PER_SUBJECT) {
    errors.push(
      `${subj}: item bank has ${items} items, minimum production threshold is ${MIN_ITEMS_PER_SUBJECT}`,
    );
  }
}

console.log("-".repeat(header.length * 8));

// ---------------------------------------------------------------------------
// 2b. Per-tutor coverage matrix — walks `services/tutor-svc/src/modes/*Tutor.ts`
//     and reports each tutor's declared gradeBands × coverageMatrix status.
//     Hard errors only when a declared grade band has no matrix entry at all
//     (every band must be honestly classified as authored | scaffold | missing).
// ---------------------------------------------------------------------------

const tutorsDir = join(repoRoot, "services/tutor-svc/src/modes");
const tutorFiles = existsSync(tutorsDir)
  ? readdirSync(tutorsDir).filter((f) => f.endsWith("Tutor.ts"))
  : [];

const STATUS_GLYPH = { authored: "A", scaffold: "S", missing: "—" };
const ALL_BANDS = [
  "PRE_K",
  "K",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "ADULT",
];

function parseArrayLiteral(src, key) {
  const re = new RegExp(`${key}\\s*:\\s*\\[([^\\]]*)\\]`);
  const m = src.match(re);
  if (!m) return null;
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}
function parseCoverageMatrix(src) {
  const re = /coverageMatrix\s*:\s*\{([\s\S]*?)\n\s*\}/;
  const m = src.match(re);
  if (!m) return null;
  const out = {};
  for (const entry of m[1].matchAll(/(?:"?([A-Za-z0-9_]+)"?)\s*:\s*"([^"]+)"/g)) {
    out[entry[1]] = entry[2];
  }
  return out;
}

const tutorRows = [];
const tutorErrors = [];
for (const file of tutorFiles) {
  const src = readFileSync(join(tutorsDir, file), "utf8");
  // Prefer the persona id (short name like "nova") — falls back to the
  // tutor's full id stem ("math-coach"), then the filename stem.
  const personaId = (src.match(/persona:\s*\{[\s\S]*?id:\s*"([^"]+)"/) || [])[1];
  const id =
    personaId ??
    (src.match(/id:\s*"([^"@]+)@/) || [])[1] ??
    file.replace(/Tutor\.ts$/, "");
  const bands = parseArrayLiteral(src, "gradeBands") ?? [];
  const matrix = parseCoverageMatrix(src);
  if (bands.length === 0) continue;
  if (!matrix) {
    tutorErrors.push(`${id}: declares ${bands.length} gradeBand(s) but no coverageMatrix`);
    tutorRows.push({ id, bands, matrix: {} });
    continue;
  }
  for (const band of bands) {
    if (!(band in matrix)) {
      tutorErrors.push(`${id}: gradeBand "${band}" has no coverageMatrix entry`);
    }
  }
  tutorRows.push({ id, bands, matrix });
}

if (tutorRows.length) {
  console.log("\nPER-TUTOR COVERAGE MATRIX (A=authored, S=scaffold, —=missing)\n");
  const headCells = ["tutor"].concat(ALL_BANDS);
  console.log(headCells.map((h) => h.padEnd(8)).join(""));
  console.log("-".repeat(headCells.length * 8));
  for (const row of tutorRows.sort((a, b) => a.id.localeCompare(b.id))) {
    const declared = new Set(row.bands);
    const cells = ALL_BANDS.map((band) => {
      if (!declared.has(band)) return "·".padEnd(8);
      const s = row.matrix[band];
      return (STATUS_GLYPH[s] ?? "?").padEnd(8);
    });
    console.log(row.id.padEnd(8) + cells.join(""));
  }
  console.log("-".repeat(headCells.length * 8));
  console.log("legend: · = not in catalog scope for this tutor\n");
  console.log("see docs/quality/tutor-k12-coverage-gap-plan.md for the rollout plan.");
}

errors.push(...tutorErrors);

// Surplus subjects — informational
const declaredSubjects = new Set(coverage.keys());
const expected = new Set(subjects);
const surplus = [...declaredSubjects].filter((s) => !expected.has(s));
if (surplus.length) {
  console.log(`\nadditional subjects seeded (informational, not required): ${surplus.join(", ")}`);
}

console.log("\nrequired thresholds:");
console.log(`  - every subject covers grade bands K through 8`);
console.log(`  - every subject has ≥ ${MIN_ITEMS_PER_SUBJECT} item bank entries`);

if (warnings.length) {
  console.log("\nwarnings:");
  for (const w of warnings) console.log(`  warn: ${w}`);
}
if (errors.length) {
  console.error("\nerrors:");
  for (const e of errors) console.error(`  error: ${e}`);
  console.error(`\ncurriculum:coverage FAILED with ${errors.length} error(s).`);
  console.error("See docs/quality/red-to-green-backlog.md (P2-203, GREEN-03).");
  process.exit(1);
}
console.log("\ncurriculum:coverage OK.");
