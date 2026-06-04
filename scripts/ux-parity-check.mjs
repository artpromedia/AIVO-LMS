#!/usr/bin/env node
// ux:parity — Sprint GREEN-08 gate.
//
// Distinct lens from `mobile:parity:strict` (route presence) and
// `route:audit` (Next.js state-file convention). This gate enforces
// the design-system / UX-state contract described in
// docs/quality/ux-parity-matrix.md:
//
//   1. Canonical UX-state primitives ship on disk and export the
//      expected symbols:
//        - packages/ui/src/states/EmptyState.tsx exports EmptyState
//        - packages/ui/src/states/index.ts re-exports it
//        - apps/web-v2/components/ui/empty-state.tsx exports EmptyState
//        - apps/web-v2/components/offline/offline-banner.tsx exports
//          OfflineBanner
//        - apps/web-v2/app/layout.tsx exists (canonical app shell)
//
//   2. Each shipping role surface (learner, parent, teacher,
//      admin/school, admin/district) uses the EmptyState primitive
//      in at least one page.tsx. Empty-data dead ends are the most
//      common UX regression and the matrix calls them out as
//      mandatory.
//
//   3. Web ⇄ Mobile parity matrix is clean — invokes
//      `scripts/web-mobile-parity-check.mjs --strict` as a subprocess
//      and requires exit code 0. Drift in the curated matrix means
//      either a new web route appeared without a mobile decision or
//      a referenced mobile screen disappeared.
//
// This script does NOT cover axe / keyboard / screen-reader / motion
// — that's the GREEN-09 `a11y:audit` lens. It also does NOT cover
// tutor visual quality (no-emoji rule); that's downstream content
// work and is tracked in docs/quality/ux-parity-matrix.md notes.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const errors = [];

function readOrError(relPath) {
  const abs = join(repoRoot, relPath);
  if (!existsSync(abs)) {
    errors.push(`${relPath} missing.`);
    return null;
  }
  return readFileSync(abs, "utf8");
}

function mustExport(
  src,
  file,
  exportName,
  kindPattern = "(?:function|const|class|type|interface)",
) {
  const re = new RegExp(`export\\s+${kindPattern}\\s+${exportName}\\b`);
  if (!re.test(src)) {
    errors.push(`${file}: must export "${exportName}".`);
  }
}

// --- 1. Canonical UX-state primitives --------------------------------

const uiEmptyRel = "packages/ui/src/states/EmptyState.tsx";
const uiEmptySrc = readOrError(uiEmptyRel);
if (uiEmptySrc) mustExport(uiEmptySrc, uiEmptyRel, "EmptyState", "const");

const uiStatesIdxRel = "packages/ui/src/states/index.ts";
const uiStatesIdxSrc = readOrError(uiStatesIdxRel);
if (uiStatesIdxSrc && !/EmptyState\b/.test(uiStatesIdxSrc)) {
  errors.push(`${uiStatesIdxRel}: must re-export EmptyState.`);
}

const webEmptyRel = "apps/web-v2/components/ui/empty-state.tsx";
const webEmptySrc = readOrError(webEmptyRel);
if (webEmptySrc) mustExport(webEmptySrc, webEmptyRel, "EmptyState", "function");

const offlineRel = "apps/web-v2/components/offline/offline-banner.tsx";
const offlineSrc = readOrError(offlineRel);
if (offlineSrc) mustExport(offlineSrc, offlineRel, "OfflineBanner", "function");

const shellRel = "apps/web-v2/app/layout.tsx";
if (!existsSync(join(repoRoot, shellRel))) {
  errors.push(`${shellRel} missing — canonical app shell.`);
}

// --- 2. Per-role EmptyState usage ------------------------------------

const ROLE_BUCKETS = [
  { label: "learner", dir: "apps/web-v2/app/learner" },
  { label: "parent", dir: "apps/web-v2/app/parent" },
  { label: "teacher", dir: "apps/web-v2/app/teacher" },
  { label: "admin/school", dir: "apps/web-v2/app/admin/school" },
  { label: "admin/district", dir: "apps/web-v2/app/admin/district" },
];

function findPageFilesWithEmptyState(absDir) {
  if (!existsSync(absDir)) return { pageCount: 0, hits: [] };
  const hits = [];
  let pageCount = 0;
  const stack = [absDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const abs = join(dir, entry);
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        stack.push(abs);
      } else if (entry === "page.tsx") {
        pageCount += 1;
        const src = readFileSync(abs, "utf8");
        if (/\bEmptyState\b/.test(src)) hits.push(abs);
      }
    }
  }
  return { pageCount, hits };
}

for (const bucket of ROLE_BUCKETS) {
  const abs = join(repoRoot, bucket.dir);
  const { pageCount, hits } = findPageFilesWithEmptyState(abs);
  if (pageCount === 0) {
    errors.push(
      `${bucket.dir}: no page.tsx found — role surface is missing entirely (contract: docs/quality/ux-parity-matrix.md).`,
    );
    continue;
  }
  if (hits.length === 0) {
    errors.push(
      `${bucket.dir}: ${pageCount} page.tsx file(s) but none reference EmptyState. Every shipping role surface must handle empty-data states via the design-system primitive (contract: docs/quality/ux-parity-matrix.md "Required UX states").`,
    );
  }
}

// --- 3. Web ⇄ Mobile parity matrix clean -----------------------------

const parityScript = join(repoRoot, "scripts/web-mobile-parity-check.mjs");
if (!existsSync(parityScript)) {
  errors.push("scripts/web-mobile-parity-check.mjs missing — required by ux:parity gate.");
} else {
  const result = spawnSync(process.execPath, [parityScript, "--strict"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    errors.push(
      `web-mobile-parity-check.mjs --strict exited ${result.status}. Stderr tail:\n${(
        result.stderr || ""
      )
        .split(/\r?\n/)
        .slice(-12)
        .join("\n")}`,
    );
  }
}

// --- Report ---------------------------------------------------------

if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\nux:parity FAILED with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  `ux:parity OK — canonical UX-state primitives present, ${ROLE_BUCKETS.length} role surfaces use EmptyState, and web⇄mobile parity matrix is clean.`,
);
