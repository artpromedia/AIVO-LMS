#!/usr/bin/env node
/**
 * check-no-stub-on-assessment-path.mjs
 *
 * Sprint 6 anti-stub gate for the parent-assessment → collaborator invites
 * → brain build user path. Fails CI when any file under the protected
 * surfaces contains a stub marker or imports mock DATA on a real path.
 *
 * Protected surfaces (the user-facing flow this program fixed):
 *   - apps/web-v2/app/parent/learners/...            (parent onboarding UI)
 *   - apps/web-v2/app/api/bff/learners/.../parent-assessment  (submit BFF)
 *   - apps/web-v2/app/parent/learners/.../brain-clone-watch   (visual build)
 *
 * Hard-fails on (case-insensitive): TODO, FIXME, "placeholder", "lorem",
 * "Not implemented". Also fails on imports of a mock-DATA / fixtures module
 * (e.g. `.../mock-data`, `.../fixtures`, `*.fixtures`).
 *
 * NOT flagged — the `@/lib/auth/mock-session` AUTH SEAM. That module is the
 * codebase's mock-auth provider (selected by AUTH_MODE), not stub data on the
 * data path; the parent server actions legitimately read the session through
 * it. It is allow-listed by name. If a future change introduces real stub
 * data, this gate still catches the markers above.
 *
 * Usage: node scripts/check-no-stub-on-assessment-path.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();

// Repo-relative directory roots to scan. Each is walked recursively; a file
// matches a surface if its path contains one of the FILTER fragments.
const WEB = "apps/web-v2/app";
const L = "parent/learners/[learnerId]";
const SURFACES = [
  { root: join(WEB, L, "assessment"), filter: "" },
  { root: join(WEB, L, "team"), filter: "" },
  { root: join(WEB, L, "brain-clone-watch"), filter: "" },
  { root: join(WEB, L, "iep"), filter: "" },
  { root: join(WEB, "api/bff/learners"), filter: "parent-assessment" },
];

const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);

// Stub markers — whole-word / phrase, case-insensitive. Deliberately NOT a
// bare /placeholder/ : a JSX `placeholder=` attribute and i18n keys like
// `*_placeholder` are legitimate input hints, not stubs. We only flag
// placeholder when it reads as stub intent (a "placeholder <noun>" phrase or
// a leading `// placeholder` comment).
const STUB_MARKERS = [
  /\bTODO\b/,
  /\bFIXME\b/,
  /not\s+implemented/i,
  /\blorem\s+ipsum\b/i,
  /\bplaceholder\s+(?:data|content|display|text|copy|value|markup|component|page|screen|ui|image|asset)\b/i,
  /^\s*(?:\/\/|\*)\s*placeholder\b/i,
];

// Mock-DATA / fixture imports (NOT the auth seam). Match an import/require
// whose module path ends in mock-data, fixtures, or *.fixtures.
const MOCK_DATA_IMPORT =
  /\b(?:import|require)\b[^\n;]*?["'][^"']*(?:mock-data|\/fixtures|\.fixtures)["']/;

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      // Never scan test/snapshot dirs — stubs there are fine.
      if (["__tests__", "__snapshots__", "node_modules"].includes(ent.name)) continue;
      yield* walk(full);
    } else if (ent.isFile()) {
      const dot = ent.name.lastIndexOf(".");
      const ext = dot >= 0 ? ent.name.slice(dot) : "";
      // Skip test files — the gate guards shipped UI/route code only.
      if (/\.(test|spec)\.[tj]sx?$/.test(ent.name)) continue;
      if (SOURCE_EXTS.has(ext)) yield full;
    }
  }
}

const violations = [];
for (const surface of SURFACES) {
  const abs = join(ROOT, surface.root);
  try {
    statSync(abs);
  } catch {
    continue;
  }
  for (const file of walk(abs)) {
    const rel = relative(ROOT, file).split(sep).join("/");
    if (surface.filter && !rel.includes(surface.filter)) continue;
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const re of STUB_MARKERS) {
        if (re.test(line)) {
          violations.push({ file: rel, line: i + 1, reason: "stub marker", text: line.trim() });
        }
      }
      if (MOCK_DATA_IMPORT.test(line)) {
        violations.push({ file: rel, line: i + 1, reason: "mock-data import", text: line.trim() });
      }
    }
  }
}

if (violations.length > 0) {
  console.error("✖ stub/mock-data found on the parent-assessment → brain-build path:");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.reason}]  ${v.text.slice(0, 140)}`);
  }
  console.error(
    `\n${violations.length} violation(s). This path must ship real code: no ` +
      `TODO/FIXME/placeholder/lorem/"Not implemented", and no mock-data/fixture ` +
      `imports on a real user path. (The @/lib/auth/mock-session auth seam is allowed.)`,
  );
  process.exit(1);
}

console.log("✓ no stubs or mock-data on the parent-assessment → brain-build path");
