#!/usr/bin/env node
// ux:matrix — Subject × Tutor × Platform experience gate (Sprint 0 of
// docs/SUBJECT_TUTOR_UX_GAP_ANALYSIS_AND_SPRINTS.md).
//
// This is the source-of-truth regression guard the later subject/tutor UX
// sprints close against. For every canonical tutor (packages/brand TUTORS)
// and every learner subject (packages/brand LEARNER_SUBJECTS) it verifies the
// learner-facing client path is coherent on BOTH web (apps/web-v2) and mobile
// (apps/mobile):
//
//   Catalog integrity (HARD errors — these should never happen):
//     1. Each subject's tutorKey exists in brand TUTORS.
//     2. That tutorKey has a TutorDefinition in the tutor-svc registry.
//     3. That tutorKey has a starter content pack.
//     4. The web + mobile subject-detail routes and the mobile tutor route
//        exist on disk (the dynamic renderers every subject/tutor depends on).
//
//   Tracked state (recorded in a baseline, fails only on REGRESSION — exactly
//   like scripts/curriculum-coverage-check.mjs):
//     • Per (subject, platform) status:
//         P  = reachable (rendered by the client)
//         H  = hidden / unreachable (filtered out, no coming-soon path)
//     • Per tutor reachability:
//         linked = reachable from ≥1 subject row OR marked tutorOnly:true
//         orphan = no subject row and not tutorOnly (atlas/cadence/vigor/forge
//                  today — surfaced as a tracked gap until Sprint 1 resolves it)
//
//   A subject status regressing (P→H), a tutor regressing (linked→orphan), or a
//   catalog-integrity break is a hard fail. Improvements (H→P, orphan→linked)
//   emit a warning to update the baseline in the same PR. This locks in progress
//   and forbids backsliding without making CI red on the already-known gaps.
//
// Outputs:
//   docs/quality/subject-tutor-ux-matrix.md     (regenerated every run)
//   docs/quality/subject-tutor-ux-baseline.json (regression ratchet; edit in PR)
//
// Run: `pnpm ux:matrix`

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const errors = [];
const warnings = [];
const improvements = [];

function readOrFail(rel) {
  const abs = join(repoRoot, rel);
  if (!existsSync(abs)) {
    errors.push(`${rel} not found`);
    return null;
  }
  return readFileSync(abs, "utf8");
}

// ---------------------------------------------------------------------------
// 1. Parse the canonical catalogs from source (regex — no TS import, matching
//    the convention used by scripts/tutor-parity-check.mjs).
// ---------------------------------------------------------------------------

// Brand TUTORS -> { key: { tutorOnly: bool } }
const brandSrc = readOrFail("packages/brand/src/index.ts");
const tutors = new Map();
if (brandSrc) {
  const m = brandSrc.match(/export const TUTORS = \{([\s\S]*?)\n\} as const;/);
  if (!m) {
    errors.push("packages/brand: TUTORS constant not parseable");
  } else {
    // Split into top-level `key: { ... }` blocks.
    const body = m[1];
    const keyRe = /^\s{2}([a-z]+):\s*\{([\s\S]*?)\n\s{2}\},?$/gm;
    let km;
    while ((km = keyRe.exec(body)) !== null) {
      const key = km[1];
      const block = km[2];
      const tutorOnly = /tutorOnly:\s*true/.test(block);
      tutors.set(key, { tutorOnly });
    }
  }
}

// LEARNER_SUBJECTS -> [{ slug, tutorKey, productionReady, comingSoon }]
const subjectsSrc = readOrFail("packages/brand/src/subjects.ts");
const subjects = [];
if (subjectsSrc) {
  const m = subjectsSrc.match(/export const LEARNER_SUBJECTS = \[([\s\S]*?)\n\] as const/);
  if (!m) {
    errors.push("packages/brand: LEARNER_SUBJECTS constant not parseable");
  } else {
    const body = m[1];
    const objRe = /\{([\s\S]*?)\}/g;
    let om;
    while ((om = objRe.exec(body)) !== null) {
      const block = om[1];
      const slug = block.match(/slug:\s*"([^"]+)"/)?.[1];
      if (!slug) continue;
      const tutorKey = block.match(/tutorKey:\s*"([^"]+)"/)?.[1];
      const productionReady = /productionReady:\s*true/.test(block);
      const comingSoon = /comingSoon:\s*true/.test(block);
      subjects.push({ slug, tutorKey, productionReady, comingSoon });
    }
  }
}

// Runtime registry keys.
const registrySrc = readOrFail("services/tutor-svc/src/modes/registry.ts");
const registryKeys = new Set();
if (registrySrc) {
  const block = registrySrc.match(/TUTOR_REGISTRY[^=]*=\s*\{([\s\S]*?)^\};/m);
  if (!block) {
    errors.push("tutor-svc: TUTOR_REGISTRY not parseable");
  } else {
    for (const mm of block[1].matchAll(/^\s*([a-z]+):\s*\w+,?\s*$/gm)) {
      registryKeys.add(mm[1]);
    }
  }
}

// Starter content pack keys.
const packsSrc = readOrFail("services/tutor-svc/src/content-packs/index.ts");
const packKeys = new Set();
if (packsSrc) {
  const block = packsSrc.match(/STARTER_CONTENT_PACKS[^=]*=\s*\{([\s\S]*?)^\};/m);
  if (!block) {
    errors.push("tutor-svc: STARTER_CONTENT_PACKS not parseable");
  } else {
    for (const mm of block[1].matchAll(/^\s*([a-z]+):\s*\w+,?\s*$/gm)) {
      packKeys.add(mm[1]);
    }
  }
}

// Surface capability registry (Sprint 3) — the canonical per-platform support
// level for each activity surface. Parsed from source so the matrix reports
// surface coverage from data instead of guessing.
const capSrc = readOrFail("packages/learner-surfaces/src/SurfaceRouter/surface-capability.ts");
const surfaceCaps = [];
if (capSrc) {
  const block = capSrc.match(/SURFACE_CAPABILITY_REGISTRY[^=]*=\s*\{([\s\S]*?)^\};/m);
  if (!block) {
    errors.push("learner-surfaces: SURFACE_CAPABILITY_REGISTRY not parseable");
  } else {
    const rowRe =
      /([a-z_]+):\s*\{\s*web:\s*"(full|fallback|none)",\s*mobile:\s*"(full|fallback|none)",\s*note:\s*"([^"]*)"/g;
    let rm;
    while ((rm = rowRe.exec(block[1])) !== null) {
      surfaceCaps.push({ type: rm[1], web: rm[2], mobile: rm[3], note: rm[4] });
    }
    if (surfaceCaps.length === 0) {
      errors.push("learner-surfaces: SURFACE_CAPABILITY_REGISTRY parsed 0 entries");
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Structural routes every subject / tutor depends on must exist on disk.
// ---------------------------------------------------------------------------

const REQUIRED_ROUTES = {
  "web subjects grid": "apps/web-v2/app/learner/subjects/page.tsx",
  "web subject detail": "apps/web-v2/app/learner/subjects/[subjectId]/page.tsx",
  "mobile subjects grid": "apps/mobile/app/(learner)/subjects/index.tsx",
  "mobile subject detail": "apps/mobile/app/(learner)/subjects/[subjectId].tsx",
  "mobile tutor route": "apps/mobile/app/(learner)/tutor/[tutorSlug].tsx",
};
for (const [label, rel] of Object.entries(REQUIRED_ROUTES)) {
  if (!existsSync(join(repoRoot, rel))) {
    errors.push(`${label} route missing: ${rel}`);
  }
}

// Bail early on structural / parse failures — the matrix below is meaningless
// if the catalogs didn't parse.
if (errors.length) emitAndExit();

// Detect whether the web subjects grid still filters to production-ready only.
// When true, a non-production / non-coming-soon subject is hidden on web.
const webGridSrc = readOrFail("apps/web-v2/app/learner/subjects/page.tsx") ?? "";
const webFiltersToProductionReady = /getProductionReadySubjects\s*\(/.test(webGridSrc);

// ---------------------------------------------------------------------------
// 3. Compute the live matrix.
// ---------------------------------------------------------------------------

// Per-subject catalog integrity + per-platform reachability.
const subjectRows = [];
for (const s of subjects) {
  if (!s.tutorKey) {
    errors.push(`subject "${s.slug}" has no tutorKey`);
    continue;
  }
  if (!tutors.has(s.tutorKey)) {
    errors.push(`subject "${s.slug}" tutorKey "${s.tutorKey}" not in brand TUTORS`);
  }
  if (!registryKeys.has(s.tutorKey)) {
    errors.push(`subject "${s.slug}" tutorKey "${s.tutorKey}" has no TutorDefinition in registry`);
  }
  if (!packKeys.has(s.tutorKey)) {
    errors.push(`subject "${s.slug}" tutorKey "${s.tutorKey}" has no starter content pack`);
  }

  // Web: hidden if the grid filters to productionReady and the subject is
  // neither productionReady nor explicitly coming-soon.
  const webReachable = s.productionReady || s.comingSoon || !webFiltersToProductionReady;
  const web = webReachable ? "P" : "H";

  // Mobile: the grid renders all brain domains and the detail/tutor routes are
  // dynamic, so any subject backed by a real tutor is reachable.
  const mobile = "P";

  subjectRows.push({ slug: s.slug, tutor: s.tutorKey, web, mobile });
}

// Per-tutor reachability.
const subjectsByTutor = new Map();
for (const s of subjects) {
  if (!s.tutorKey) continue;
  const list = subjectsByTutor.get(s.tutorKey) ?? [];
  list.push(s.slug);
  subjectsByTutor.set(s.tutorKey, list);
}

const tutorRows = [];
for (const [key, meta] of [...tutors.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const linkedSubjects = subjectsByTutor.get(key) ?? [];
  const reachable = linkedSubjects.length > 0 || meta.tutorOnly;
  tutorRows.push({
    tutor: key,
    status: reachable ? "linked" : "orphan",
    subjects: linkedSubjects,
    tutorOnly: !!meta.tutorOnly,
  });
}

// ---------------------------------------------------------------------------
// 4. Regression ratchet against docs/quality/subject-tutor-ux-baseline.json.
// ---------------------------------------------------------------------------

const STATUS_RANK = { H: 0, P: 1, F: 2 }; // higher is better
const baselinePath = join(repoRoot, "docs/quality/subject-tutor-ux-baseline.json");
const liveBaseline = {
  _comment:
    "Baseline snapshot of the subject×tutor×platform experience matrix. " +
    "Regression (a subject status dropping, e.g. P→H, or a tutor going " +
    "linked→orphan) is a hard fail. Improvements require updating this file " +
    "in the same PR. Source of truth: scripts/subject-tutor-ux-check.mjs " +
    "(`pnpm ux:matrix`). See docs/SUBJECT_TUTOR_UX_GAP_ANALYSIS_AND_SPRINTS.md.",
  snapshotDate: new Date().toISOString().slice(0, 10),
  subjects: Object.fromEntries(
    subjectRows.map((r) => [r.slug, { tutor: r.tutor, web: r.web, mobile: r.mobile }]),
  ),
  tutors: Object.fromEntries(
    tutorRows.map((r) => [r.tutor, { status: r.status, subjects: r.subjects }]),
  ),
};

if (existsSync(baselinePath)) {
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));

  for (const r of subjectRows) {
    const base = baseline.subjects?.[r.slug];
    if (!base) {
      warnings.push(`subject "${r.slug}" not in baseline — add an entry.`);
      continue;
    }
    for (const platform of ["web", "mobile"]) {
      const now = STATUS_RANK[r[platform]] ?? 0;
      const was = STATUS_RANK[base[platform]] ?? 0;
      if (now < was) {
        errors.push(
          `REGRESSION: subject "${r.slug}" ${platform} dropped ${base[platform]}→${r[platform]}.`,
        );
      } else if (now > was) {
        improvements.push(
          `subject "${r.slug}" ${platform} improved ${base[platform]}→${r[platform]} — update baseline.`,
        );
      }
    }
  }
  for (const id of Object.keys(baseline.subjects ?? {})) {
    if (!subjectRows.find((r) => r.slug === id)) {
      warnings.push(`subject "${id}" in baseline but absent from LEARNER_SUBJECTS.`);
    }
  }

  for (const r of tutorRows) {
    const base = baseline.tutors?.[r.tutor];
    if (!base) {
      warnings.push(`tutor "${r.tutor}" not in baseline — add an entry.`);
      continue;
    }
    if (base.status === "linked" && r.status === "orphan") {
      errors.push(`REGRESSION: tutor "${r.tutor}" went linked→orphan.`);
    } else if (base.status === "orphan" && r.status === "linked") {
      improvements.push(`tutor "${r.tutor}" went orphan→linked — update baseline.`);
    }
  }
  for (const id of Object.keys(baseline.tutors ?? {})) {
    if (!tutorRows.find((r) => r.tutor === id)) {
      warnings.push(`tutor "${id}" in baseline but absent from TUTORS.`);
    }
  }
} else {
  writeFileSync(baselinePath, JSON.stringify(liveBaseline, null, 2) + "\n");
  console.log("subject-tutor-ux-baseline.json created (first run).");
}

// ---------------------------------------------------------------------------
// 5. Regenerate docs/quality/subject-tutor-ux-matrix.md from the live state.
// ---------------------------------------------------------------------------

const orphans = tutorRows.filter((r) => r.status === "orphan").map((r) => r.tutor);
const hiddenWeb = subjectRows.filter((r) => r.web === "H").map((r) => r.slug);

const md = [];
md.push("# Subject × Tutor × Platform Experience Matrix");
md.push("");
md.push("> Auto-generated by `pnpm ux:matrix` (`scripts/subject-tutor-ux-check.mjs`).");
md.push("> Do not hand-edit — regenerated every run. See");
md.push("> `docs/SUBJECT_TUTOR_UX_GAP_ANALYSIS_AND_SPRINTS.md` for the rollout plan.");
md.push("");
md.push(`> Snapshot: ${liveBaseline.snapshotDate}`);
md.push("");
md.push(
  "**Legend** — **F** full · **P** partial (reachable, generic/fallback) · " +
    "**H** hidden/unreachable · **O** orphan (tutor with no subject card).",
);
md.push("");
md.push("## Subjects");
md.push("");
md.push("| Subject (slug) | Tutor | Web | Mobile |");
md.push("| --- | --- | :---: | :---: |");
for (const r of subjectRows) {
  md.push(`| ${r.slug} | ${r.tutor} | ${r.web} | ${r.mobile} |`);
}
md.push("");
md.push("## Tutors");
md.push("");
md.push("| Tutor | Status | Subjects |");
md.push("| --- | :---: | --- |");
for (const r of tutorRows) {
  const status = r.status === "orphan" ? "O (orphan)" : "linked";
  md.push(`| ${r.tutor} | ${status} | ${r.subjects.join(", ") || "—"} |`);
}
md.push("");
md.push("## Aggregate");
md.push("");
md.push("| Metric | Count |");
md.push("| --- | ---: |");
md.push(`| subjects total | ${subjectRows.length} |`);
md.push(`| subjects reachable on web (P/F) | ${subjectRows.filter((r) => r.web !== "H").length} |`);
md.push(`| subjects hidden on web (H) | ${hiddenWeb.length} |`);
md.push(
  `| subjects reachable on mobile (P/F) | ${subjectRows.filter((r) => r.mobile !== "H").length} |`,
);
md.push(`| tutors total | ${tutorRows.length} |`);
md.push(`| orphan tutors (O) | ${orphans.length} |`);
md.push("");
if (orphans.length) {
  md.push(`**Orphan tutors** (no subject card; Sprint 1 target): ${orphans.join(", ")}.`);
  md.push("");
}
if (hiddenWeb.length) {
  md.push(`**Hidden on web** (filtered out, Sprint 1 target): ${hiddenWeb.join(", ")}.`);
  md.push("");
}

// Surface capability (Sprint 3) — sourced from SURFACE_CAPABILITY_REGISTRY.
if (surfaceCaps.length) {
  const lvl = (v) => (v === "full" ? "✅ full" : v === "fallback" ? "⚠️ fallback" : "❌ none");
  md.push("## Activity surface capability");
  md.push("");
  md.push("> Source of truth: `packages/learner-surfaces` `SURFACE_CAPABILITY_REGISTRY`.");
  md.push("");
  md.push("| Surface | Web | Mobile | Primary subject / tutor |");
  md.push("| --- | :---: | :---: | --- |");
  for (const c of surfaceCaps) {
    md.push(`| ${c.type} | ${lvl(c.web)} | ${lvl(c.mobile)} | ${c.note} |`);
  }
  md.push("");
  const fullWeb = surfaceCaps.filter((c) => c.web === "full").length;
  const fullMobile = surfaceCaps.filter((c) => c.mobile === "full").length;
  md.push(
    `Surfaces with a full renderer: **web ${fullWeb}/${surfaceCaps.length}**, ` +
      `**mobile ${fullMobile}/${surfaceCaps.length}**. ` +
      "Non-full surfaces render a labelled fallback that emits `unsupported_surface`.",
  );
  md.push("");
}

const matrixPath = join(repoRoot, "docs/quality/subject-tutor-ux-matrix.md");
const desired = md.join("\n");
let current = "";
if (existsSync(matrixPath)) current = readFileSync(matrixPath, "utf8");
if (current !== desired) {
  writeFileSync(matrixPath, desired);
  console.log("subject-tutor-ux-matrix.md regenerated.");
}

// ---------------------------------------------------------------------------
// 6. Console summary + exit.
// ---------------------------------------------------------------------------

const pad = (s, n) => String(s).padEnd(n);
console.log("\nSUBJECT × TUTOR × PLATFORM MATRIX\n");
console.log(pad("subject", 22), pad("tutor", 10), pad("web", 5), "mobile");
console.log("-".repeat(50));
for (const r of subjectRows) {
  console.log(pad(r.slug, 22), pad(r.tutor, 10), pad(r.web, 5), r.mobile);
}
console.log("-".repeat(50));
console.log(
  `\nsubjects: ${subjectRows.length} · hidden-on-web: ${hiddenWeb.length} · orphan tutors: ${orphans.length}`,
);
if (surfaceCaps.length) {
  const fullWeb = surfaceCaps.filter((c) => c.web === "full").length;
  const fullMobile = surfaceCaps.filter((c) => c.mobile === "full").length;
  console.log(
    `surfaces: ${surfaceCaps.length} · full-on-web: ${fullWeb} · full-on-mobile: ${fullMobile}`,
  );
}

emitAndExit();

function emitAndExit() {
  if (improvements.length) {
    console.log("\nimprovements (update the baseline to lock these in):");
    for (const i of improvements) console.log(`  +    ${i}`);
  }
  if (warnings.length) {
    console.log("\nwarnings:");
    for (const w of warnings) console.log(`  warn: ${w}`);
  }
  if (errors.length) {
    console.error("\nerrors:");
    for (const e of errors) console.error(`  error: ${e}`);
    console.error(`\nux:matrix FAILED with ${errors.length} error(s).`);
    process.exit(1);
  }
  console.log("\nux:matrix OK.");
  process.exit(0);
}
