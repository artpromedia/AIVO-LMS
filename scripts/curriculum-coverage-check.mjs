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

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// 0. Authoritative item counts — @aivo/item-bank's coverage-query module.
//
// Sprint 01 (remediation): the gate previously trusted the hand-maintained
// production-manifest.json for item counts, which let declared coverage
// drift above the real item set. The counts now come from the SAME compiled
// module production consumers use (`countAuthoredItems` /
// `authoredItemCountsByBand`), so the gate and reality cannot disagree.
// The dist build is refreshed automatically when the package sources are
// newer (or dist is missing), mirroring the `item-bank:validate` pattern.
// ---------------------------------------------------------------------------

const itemBankDist = join(repoRoot, "packages/item-bank/dist/index.js");
const itemBankSrcDir = join(repoRoot, "packages/item-bank/src");

function itemBankDistStale() {
  if (!existsSync(itemBankDist)) return true;
  const distMtime = statSync(itemBankDist).mtimeMs;
  const newest = (dir) => {
    let max = 0;
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (name !== "__tests__") max = Math.max(max, newest(full));
      } else if (name.endsWith(".ts") || name.endsWith(".json")) {
        max = Math.max(max, st.mtimeMs);
      }
    }
    return max;
  };
  return newest(itemBankSrcDir) > distMtime;
}

if (itemBankDistStale()) {
  console.log("@aivo/item-bank dist is missing or stale — building it for the coverage gate …");
  execSync("corepack pnpm --filter @aivo/item-bank build", { cwd: repoRoot, stdio: "inherit" });
}
const itemBank = await import(pathToFileURL(itemBankDist).href);

/**
 * Minimum production items a (tutor-subject, grade band) cell needs before a
 * `coverageMatrix` entry may claim `"authored"`. Three is the floor because
 * the item difficulty ladder has three rungs (intro / core / stretch) — one
 * real item per rung is the least a band can carry and still honestly route
 * a learner through it. Raising the bar later only requires authoring more
 * items; it can never be satisfied by editing a manifest.
 */
const MIN_AUTHORED_ITEMS_PER_BAND = 3;

// Subjects → required grade bands (lowercase canonical).
// Grade bands are matched as substring tokens against seed `gradeBand`
// declarations so a seed that declares `gradeBand: "K-2"` covers K, 1, 2.
const REQUIRED_COVERAGE = {
  math: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  ela: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  science: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  writing: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  sel: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  speech: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  executive_function: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  life_skills: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  creative_arts: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  social_studies: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  world_languages: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  coding: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  geography: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  music: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  pe_health: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  stem_engineering: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
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
  if (/^PRE_K$/i.test(b)) return ["PRE_K"];
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
    for (let i = start; i <= 12; i++) out.push(String(i));
    return out;
  }
  if (/^\d+$/.test(b)) return [b];
  return [];
}

function extractGraphBlocks(src) {
  const starts = [...src.matchAll(/^export const \w+:\s*SkillGraph\s*=/gm)].map(
    (match) => match.index,
  );
  if (starts.length === 0) return [src];
  return starts.map((start, index) => src.slice(start, starts[index + 1] ?? src.length));
}

for (const file of seedFiles) {
  const src = readFileSync(join(seedsDir, file), "utf8");
  for (const graphSrc of extractGraphBlocks(src)) {
  const graphId =
    (graphSrc.match(/^\s*id:\s*"([^"]+)"/m) || [])[1] ?? file.replace(/\.ts$/, "");
  // Per-graph subject + gradeBand
  const graphSubject = (graphSrc.match(/^\s*subject:\s*"([^"]+)"/m) || [])[1];
  const graphGrade = (graphSrc.match(/^\s*gradeBand:\s*"([^"]+)"/m) || [])[1];
  // Per-skill subject + gradeBand (override)
  const skillRe = /\{\s*id:\s*"([^"]+)"[\s\S]*?subject:\s*"([^"]+)"[\s\S]*?gradeBand:\s*"([^"]+)"/g;
  let any = false;
  for (const m of graphSrc.matchAll(skillRe)) {
    record(m[2], m[3]);
    any = true;
  }
  if (!any && graphSubject && graphGrade) {
    record(graphSubject, graphGrade);
  }
  if (graphSubject) {
    for (const grade of inferGraphBands(graphId)) record(graphSubject, grade);
  }
  }
}

// ---------------------------------------------------------------------------
// 2. Item bank: REAL counts from the compiled @aivo/item-bank production
//    loader. No regex scans, no manifest overrides — `production-manifest.json`
//    is now only a consistency fixture for the package's own tests; the gate
//    counts the items production code actually serves. Per-band counts come
//    from `authoredItemCountsByBand` (skillId-decoded grade bands), which the
//    promotion guard compares against MIN_AUTHORED_ITEMS_PER_BAND.
// ---------------------------------------------------------------------------

const itemCountsBySubject = new Map(Object.entries(itemBank.getProductionItemCounts()));
/** subject → Record<gradeBand, count> over the real production items. */
const bandCountsBySubject = new Map(
  Object.keys(REQUIRED_COVERAGE).map((subject) => [
    subject,
    itemBank.authoredItemCountsByBand(subject),
  ]),
);
const preKItemCountsBySubject = new Map(
  [...bandCountsBySubject.entries()].map(([subject, bands]) => [subject, bands.PRE_K ?? 0]),
);

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
  if ((preKItemCountsBySubject.get(subj) ?? 0) < 1) {
    errors.push(`${subj}: PRE_K item bank has no production entries`);
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
    personaId ?? (src.match(/id:\s*"([^"@]+)@/) || [])[1] ?? file.replace(/Tutor\.ts$/, "");
  const bands = parseArrayLiteral(src, "gradeBands") ?? [];
  const matrix = parseCoverageMatrix(src);
  const tutorSubjects = parseArrayLiteral(src, "subjects") ?? [];
  if (bands.length === 0) continue;
  if (tutorSubjects.length === 0) {
    tutorErrors.push(`${id}: could not parse a \`subjects\` array — authored bands cannot be verified against the item bank`);
  }
  if (!matrix) {
    tutorErrors.push(`${id}: declares ${bands.length} gradeBand(s) but no coverageMatrix`);
    tutorRows.push({ id, file, src, bands, subjects: tutorSubjects, matrix: {} });
    continue;
  }
  for (const band of bands) {
    if (!(band in matrix)) {
      tutorErrors.push(`${id}: gradeBand "${band}" has no coverageMatrix entry`);
    }
  }
  tutorRows.push({ id, file, src, bands, subjects: tutorSubjects, matrix });
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

// ---------------------------------------------------------------------------
// 2c. Per-tutor regression ratchet — locks in coverage progress.
//
// Compares the live per-tutor matrix against the snapshot in
// `docs/quality/tutor-coverage-baseline.json`. A tutor's `authored` count
// MUST NOT decrease and its `missing` count MUST NOT increase. Improvements
// (authored↑, missing↓) are encouraged but require updating the baseline
// in the same PR — this prevents silent regressions and keeps the
// baseline in sync with reality.
// ---------------------------------------------------------------------------

const baselinePath = join(repoRoot, "docs/quality/tutor-coverage-baseline.json");
if (existsSync(baselinePath)) {
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const live = {};
  for (const row of tutorRows) {
    const counts = { authored: 0, scaffold: 0, missing: 0 };
    for (const band of row.bands) {
      const s = row.matrix[band];
      if (s === "authored" || s === "scaffold" || s === "missing") counts[s]++;
    }
    live[row.id] = counts;
  }
  for (const [id, base] of Object.entries(baseline.tutors ?? {})) {
    const now = live[id];
    if (!now) {
      errors.push(
        `tutor "${id}" present in baseline but absent from registry — update tutor-coverage-baseline.json if this is intentional.`,
      );
      continue;
    }
    if (now.authored < base.authored) {
      errors.push(
        `tutor "${id}" regressed: authored ${base.authored} → ${now.authored}. Backsliding is not allowed.`,
      );
    }
    if (now.missing > base.missing) {
      errors.push(
        `tutor "${id}" regressed: missing ${base.missing} → ${now.missing}. Backsliding is not allowed.`,
      );
    }
    if (now.authored > base.authored || now.missing < base.missing) {
      warnings.push(
        `tutor "${id}" improved (authored ${base.authored}→${now.authored}, missing ${base.missing}→${now.missing}). Update tutor-coverage-baseline.json to lock in the gain.`,
      );
    }
  }
  for (const id of Object.keys(live)) {
    if (!(id in (baseline.tutors ?? {}))) {
      errors.push(
        `tutor "${id}" exists in registry but not in tutor-coverage-baseline.json — add a baseline entry.`,
      );
    }
  }
} else {
  warnings.push(
    "docs/quality/tutor-coverage-baseline.json missing — regression ratchet is disabled.",
  );
}

// ---------------------------------------------------------------------------
// 2d. Promotion guard — a tutor cannot mark a coverageMatrix cell as
//     `authored` unless the underlying skill graph(s) are (a) NOT
//     `-draft` versions and (b) have a SME sign-off entry in
//     docs/quality/tutor-content-signoffs.json. This is the gate that
//     prevents AI-drafted scaffolds from being silently promoted to
//     production without human review.
// ---------------------------------------------------------------------------

const signoffsPath = join(repoRoot, "docs/quality/tutor-content-signoffs.json");
const signoffs = existsSync(signoffsPath)
  ? (JSON.parse(readFileSync(signoffsPath, "utf8")).signoffs ?? {})
  : null;

const graphVersionById = new Map();
for (const file of seedFiles) {
  const src = readFileSync(join(seedsDir, file), "utf8");
  for (const graphSrc of extractGraphBlocks(src)) {
    const id = (graphSrc.match(/^\s*id:\s*"([^"]+)"/m) || [])[1];
    const version = (graphSrc.match(/^\s*version:\s*"([^"]+)"/m) || [])[1];
    if (id) graphVersionById.set(id, version ?? "unknown");
  }
}

// Heuristic mapping from graph id → set of grade bands the graph claims
// to cover. K-2 era seeds declare all skills at "K" but their id implies
// K-2 coverage; we rely on the id pattern here rather than per-skill
// data. Authoritative band tracking belongs in the graph file itself
// (future work); this map is the pragmatic bridge.
function inferGraphBands(graphId) {
  const bands = new Set();
  const range = (lo, hi) => {
    for (let i = lo; i <= hi; i++) bands.add(i === 0 ? "K" : String(i));
  };
  // Explicit overrides for the established named bands.
  if (/-early$/.test(graphId)) {
    bands.add("PRE_K");
    range(0, 2);
    return bands;
  }
  if (/-school-age$/.test(graphId)) {
    range(3, 8);
    return bands;
  }
  if (/-novice-low$/.test(graphId)) {
    bands.add("6");
    return bands;
  }
  if (/-6-plus$/.test(graphId)) {
    range(6, 12);
    bands.add("ADULT");
    return bands;
  }
  if (/-prek$/.test(graphId) || /^prek-/.test(graphId)) {
    bands.add("PRE_K");
    return bands;
  }
  // Numeric range like "-3-12", "-9-12", "-k-8", "-k2", "-1-8".
  let m = graphId.match(/(?:^|-)(k|\d+)-(\d+)$/i);
  if (m) {
    const lo = m[1].toUpperCase() === "K" ? 0 : Number(m[1]);
    const hi = Number(m[2]);
    range(lo, hi);
    return bands;
  }
  // Compact trailing K ranges such as "-k2".
  m = graphId.match(/(?:^|-)k(\d+)$/i);
  if (m) {
    range(0, Number(m[1]));
    return bands;
  }
  // Single trailing grade like "-k" or "-9".
  m = graphId.match(/-(k|\d+)$/i);
  if (m) {
    const g = m[1].toUpperCase() === "K" ? "K" : m[1];
    bands.add(g);
    return bands;
  }
  // Mid-id like "ngss-k2-physical-science" — look for a band token.
  m = graphId.match(/-(k2|k-8|k-12|\d+-\d+)-/i);
  if (m) {
    const tok = m[1].toLowerCase();
    const inner = tok.match(/^(k|\d+)-?(\d+)$/);
    if (inner) {
      const lo = inner[1].toUpperCase() === "K" ? 0 : Number(inner[1]);
      const hi = Number(inner[2]);
      range(lo, hi);
      return bands;
    }
  }
  return bands;
}

const graphBandsById = new Map();
for (const id of graphVersionById.keys()) {
  graphBandsById.set(id, inferGraphBands(id));
}

if (signoffs === null) {
  errors.push("docs/quality/tutor-content-signoffs.json missing — promotion guard cannot run.");
} else {
  // For every `authored` cell, BOTH of:
  //   (a) at least one referenced graph that covers the cell's band must be
  //       production-ready: non-draft version AND signed off in
  //       tutor-content-signoffs.json, and
  //   (b) the tutor's subject item bank(s) must carry at least
  //       MIN_AUTHORED_ITEMS_PER_BAND real production items at that band
  //       (counted from the compiled @aivo/item-bank, never a manifest).
  // (b) is the Sprint 01 honesty bar: a signed graph without items is a
  // catalog promise the runtime cannot keep.
  for (const row of tutorRows) {
    const refs = parseArrayLiteral(row.src, "skillGraphRefs") ?? [];
    const tutorSubjects = (row.subjects ?? []).filter((s) => s in REQUIRED_COVERAGE);
    for (const [band, status] of Object.entries(row.matrix)) {
      if (status !== "authored") continue;
      // (b) item-count bar — sum across the tutor's declared subjects (the
      // tutor's whole teachable pool counts toward the band).
      const bandItems = tutorSubjects.reduce(
        (sum, subject) => sum + (bandCountsBySubject.get(subject)?.[band] ?? 0),
        0,
      );
      if (tutorSubjects.length === 0) {
        errors.push(
          `tutor "${row.id}" claims band "${band}" is authored but its subjects ` +
            `could not be mapped to item-bank subjects — cannot verify item backing.`,
        );
      } else if (bandItems < MIN_AUTHORED_ITEMS_PER_BAND) {
        errors.push(
          `tutor "${row.id}" claims band "${band}" is authored but ` +
            `${tutorSubjects.join("+")} has only ${bandItems} production item(s) at that band ` +
            `(authored requires ≥ ${MIN_AUTHORED_ITEMS_PER_BAND}). ` +
            `Author real items or mark the band "scaffold".`,
        );
      }
      // (a) graph readiness — candidates = refs that cover this band.
      const candidates = refs
        .filter((ref) => graphBandsById.get(ref)?.has(band))
        .map((ref) => ({
          ref,
          version: graphVersionById.get(ref) ?? "unknown",
          signed: (signoffs[ref]?.length ?? 0) > 0,
          smeSigned: (signoffs[ref] ?? []).some((entry) => entry.tier === "sme_signoff"),
        }));
      if (candidates.length === 0) {
        errors.push(
          `tutor "${row.id}" claims band "${band}" is authored but no ` +
            `skillGraphRef in its definition covers that band.`,
        );
        continue;
      }
      const ready = candidates.filter((c) => !/-draft/i.test(c.version) && c.signed);
      if (ready.length === 0) {
        const why = candidates
          .map((c) => {
            const reasons = [];
            if (/-draft/i.test(c.version)) reasons.push(`version="${c.version}"`);
            if (!c.signed) reasons.push("no signoff");
            return `${c.ref} (${reasons.join(", ") || "ready but not flagged ready"})`;
          })
          .join("; ");
        errors.push(
          `tutor "${row.id}" claims band "${band}" is authored but its ` +
            `band-covering graphs aren't production-ready: ${why}.`,
        );
      } else if (!ready.some((c) => c.smeSigned)) {
        // Tiered signoffs (docs/quality/tutor-content-signoffs.schema.md):
        // owner attestation keeps the gate green only alongside the item
        // bar; flag it so SME review debt stays visible.
        warnings.push(
          `tutor "${row.id}" band "${band}": authored on owner/engineering attestation only ` +
            `(${ready.map((c) => c.ref).join(", ")}) — schedule a credentialed SME signoff.`,
        );
      }
    }
  }
}

// Surplus subjects — informational
const declaredSubjects = new Set(coverage.keys());
const expected = new Set(subjects);
const surplus = [...declaredSubjects].filter((s) => !expected.has(s));
if (surplus.length) {
  console.log(`\nadditional subjects seeded (informational, not required): ${surplus.join(", ")}`);
}

console.log("\nrequired thresholds:");
console.log(`  - every subject covers grade bands PRE_K through 12`);
console.log(`  - every subject has ≥ ${MIN_ITEMS_PER_SUBJECT} item bank entries`);
console.log(`  - every subject has at least one explicit PRE_K production item`);
console.log(
  `  - every "authored" coverageMatrix cell is backed by ≥ ${MIN_AUTHORED_ITEMS_PER_BAND} ` +
    `real production items at that band AND a signed, non-draft skill graph`,
);

// ---------------------------------------------------------------------------
// 4. Regenerate docs/quality/coverage-dashboard.md from the live matrix.
//    The dashboard is a human-readable snapshot of the per-tutor state;
//    we rewrite it every run so the doc never goes stale. CI should run
//    `pnpm curriculum:coverage` and then `git diff --exit-code` on this
//    file to catch out-of-date dashboards.
// ---------------------------------------------------------------------------

if (tutorRows.length) {
  const dashboardPath = join(repoRoot, "docs/quality/coverage-dashboard.md");
  const STATUS_CELL = { authored: "A", scaffold: "S", missing: "—" };
  const lines = [
    "# Per-Tutor PRE-K-12 Coverage Dashboard",
    "",
    "> Auto-generated by `pnpm curriculum:coverage`. Do not edit by hand —",
    "> changes here are overwritten on the next run. To update the underlying",
    "> data, edit `services/tutor-svc/src/modes/*Tutor.ts` (`coverageMatrix`",
    "> field) and re-run the script.",
    "",
    "**Legend**: A = authored (SME-signed-off production content), " +
      "S = scaffold (AI-draft or pre-review), — = missing (declared but no content), " +
      "· = not in catalog scope for this tutor.",
    "",
    "| Tutor | " + ALL_BANDS.join(" | ") + " |",
    "| --- | " + ALL_BANDS.map(() => "---").join(" | ") + " |",
  ];
  let totA = 0,
    totS = 0,
    totM = 0;
  for (const row of [...tutorRows].sort((a, b) => a.id.localeCompare(b.id))) {
    const declared = new Set(row.bands);
    const cells = ALL_BANDS.map((band) => {
      if (!declared.has(band)) return "·";
      const s = row.matrix[band];
      if (s === "authored") totA++;
      else if (s === "scaffold") totS++;
      else if (s === "missing") totM++;
      return STATUS_CELL[s] ?? "?";
    });
    lines.push("| " + row.id + " | " + cells.join(" | ") + " |");
  }
  lines.push("");
  lines.push("## Aggregate");
  lines.push("");
  lines.push("| Status | Count |");
  lines.push("| --- | ---: |");
  lines.push(`| authored | ${totA} |`);
  lines.push(`| scaffold | ${totS} |`);
  lines.push(`| missing | ${totM} |`);
  lines.push("");
  lines.push(
    "See `docs/quality/tutor-k12-coverage-gap-plan.md` for the rollout " +
      "plan and `docs/quality/tutor-content-signoffs.json` for the SME " +
      "sign-off ledger.",
  );
  lines.push("");
  const desired = lines.join("\n");
  let current = "";
  if (existsSync(dashboardPath)) current = readFileSync(dashboardPath, "utf8");
  if (current !== desired) {
    writeFileSync(dashboardPath, desired);
    console.log("\ncoverage-dashboard.md regenerated.");
  }
}

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
