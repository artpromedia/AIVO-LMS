#!/usr/bin/env node
/**
 * a11y:no-inert-prefs — the "collected-but-inert" guard.
 *
 * The existing `accessibility:audit` gate proves each preference is DECLARED
 * (type + default + BFF). It does NOT prove the preference is APPLIED. That gap
 * is how six web prefs (breakReminders, extraHints, visualSupports,
 * keyboardOptimized, hapticsEnabled, captionsAlwaysOn) and four mobile prefs
 * (textScale, reduceMotion, readAloudDefault, captionsDefault) shipped as
 * toggles that persisted and changed nothing on screen.
 *
 * This guard closes that gap. For every accessibility preference field it
 * requires a registered CONSUMER PROOF — a token that, when found in a render /
 * behavioural path, proves the preference actually takes effect. The proof must
 * live outside the declaration, persistence, BFF, settings form, tests, and dev
 * fixtures (the places a pref is set, not applied).
 *
 * Two-way enforcement:
 *   1. Every field declared in the schema MUST have a manifest entry — add a
 *      pref without registering how it renders and the build fails.
 *   2. Every manifest proof MUST resolve to real code — claim a consumer that
 *      doesn't exist and the build fails.
 *
 * Run: node scripts/a11y/no-inert-prefs.mjs   (wired as `pnpm a11y:no-inert-prefs`)
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");

const errors = [];

/** Extract the field names from a `{ ... }` type/interface body in a file. */
function extractFields(relPath, blockStartRegex, drop = []) {
  const abs = join(repoRoot, relPath);
  if (!existsSync(abs)) {
    errors.push(`schema file missing: ${relPath}`);
    return [];
  }
  const src = readFileSync(abs, "utf8");
  const start = src.search(blockStartRegex);
  if (start === -1) {
    errors.push(`could not locate schema block in ${relPath} (${blockStartRegex})`);
    return [];
  }
  // Take from the opening brace to the matching closing brace (first `\n}`/`\n};`).
  const from = src.indexOf("{", start);
  const end = src.indexOf("\n}", from);
  const body = src.slice(from + 1, end === -1 ? undefined : end);
  const fields = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^\s{2,}([a-zA-Z][a-zA-Z0-9]*)\s*[?:]/);
    if (m && !drop.includes(m[1])) fields.push(m[1]);
  }
  return fields;
}

/**
 * Search `scopes` (dirs/files, relative to repo root) for `token` (a POSIX ERE),
 * excluding any path matching `excludeRe`. Returns the first matching file or "".
 */
function findProof(token, scopes, excludeRe) {
  const present = scopes.map((s) => join(repoRoot, s)).filter((p) => existsSync(p));
  if (present.length === 0) return "";
  let out = "";
  try {
    out = execFileSync(
      "grep",
      [
        "-rlE",
        "--include=*.ts",
        "--include=*.tsx",
        "--include=*.css",
        token,
        ...present,
      ],
      { encoding: "utf8" },
    );
  } catch {
    // grep exits 1 when there are no matches — treat as "not found".
    return "";
  }
  const files = out
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean)
    .map((f) => f.replace(repoRoot + "/", ""))
    .filter((f) => !excludeRe.test(f));
  return files[0] ?? "";
}

// Paths where a preference is DECLARED / SET / PERSISTED / TESTED — never where
// it takes effect. A proof found only here does not count.
const EXCLUDE =
  /(lib\/db\/types\.ts|lib\/db\/repos\.ts|lib\/db\/seed|lib\/db\/store|lib\/db\/persistence|lib\/validators|\/api\/bff\/|accessibility-form\.tsx|settings\/AccessibilitySettings\.tsx|lib\/preferences-logic\.ts|lib\/preferences\.tsx|\.test\.|__tests__|fixture|smoke|\/docs\/|scripts\/)/;

/**
 * Consumer proof manifest. `token` is the symbol that proves the pref is
 * applied; `scope` is where to look. Indirected prefs (e.g. mobile textScale
 * flows through `scale()`; readAloud/captions flow through
 * `useLessonAccommodations`) register the accessor as their proof.
 */
const PLATFORMS = [
  {
    name: "web (apps/web-v2 · AccessibilityProfile contract)",
    schema: "packages/accessibility-contract/src/index.ts",
    block: /export interface AccessibilityProfile \{/,
    drop: [],
    proofs: {
      reducedMotion: { token: "reducedMotion", scope: ["apps/web-v2/app/learner"] },
      highContrast: { token: "highContrast", scope: ["apps/web-v2/app/learner"] },
      largeText: { token: "largeText|data-text-scale", scope: ["apps/web-v2/app/learner", "apps/web-v2/app/a11y-modes.css"] },
      audioFirst: { token: "audioFirst", scope: ["apps/web-v2/app/learner"] },
      captionsAlwaysOn: { token: "captionsAlwaysOn", scope: ["apps/web-v2/app", "packages/learner-surfaces"] },
      hapticsEnabled: { token: "hapticsEnabled", scope: ["apps/web-v2/app/learner"] },
      readAloud: { token: "readAloud", scope: ["apps/web-v2/app/learner"] },
      dyslexiaFriendlyFont: { token: "dyslexiaFriendlyFont|data-typeface", scope: ["apps/web-v2/app/learner"] },
      shorterSteps: { token: "shorterSteps", scope: ["apps/web-v2/app/learner"] },
      extraHints: { token: "extraHints", scope: ["apps/web-v2/app/learner"] },
      visualSupports: { token: "visualSupports|data-visual-supports", scope: ["apps/web-v2/app/learner", "apps/web-v2/app/a11y-modes.css"] },
      breakReminders: { token: "breakReminders|BREAK_REMINDER", scope: ["apps/web-v2/app/learner"] },
      keyboardOptimized: { token: "keyboardOptimized|data-keyboard-optimized", scope: ["apps/web-v2/app/learner", "apps/web-v2/app/a11y-modes.css"] },
      aacEnabled: { token: "aacEnabled", scope: ["apps/web-v2/app/learner"] },
      aacInputMethod: { token: "aacInputMethod", scope: ["apps/web-v2/app/learner"] },
      aacScanDelayMs: { token: "aacScanDelayMs", scope: ["apps/web-v2/app/learner"] },
      // Calm Corner audio cues: the stored opt-in gates the breathing
      // soundscape (calm-corner.tsx → BoxBreathing) via the calm page.
      calmAudioCues: { token: "calmAudioCues", scope: ["apps/web-v2/app/learner"] },
    },
  },
  {
    name: "mobile (apps/mobile · A11yPreferences)",
    schema: "apps/mobile/lib/preferences-logic.ts",
    block: /export interface A11yPreferences \{/,
    drop: [],
    proofs: {
      // reduceMotion / readAloudDefault / captionsDefault flow through
      // resolveLessonAccommodations -> useLessonAccommodations into the surface.
      reduceMotion: { token: "reduceMotion|reducedMotion", scope: ["apps/mobile/src", "apps/mobile/hooks"] },
      textScale: { token: "scale\\(|textScaleFactor", scope: ["apps/mobile/src/components/learning"] },
      readAloudDefault: { token: "useLessonAccommodations|accommodations.readAloud|\\.readAloud", scope: ["apps/mobile/src/components/learning"] },
      captionsDefault: { token: "captionsAlwaysOn|useLessonAccommodations", scope: ["apps/mobile/src/components/learning"] },
      dyslexiaFriendlyFont: { token: "dyslexiaFriendlyFont|bodyFontFamily|DYSLEXIC_BODY_FONT", scope: ["apps/mobile/src", "apps/mobile/lib/a11y-style.tsx"] },
      breakReminders: { token: "breakReminders", scope: ["apps/mobile/src/components/learning"] },
      breakIntervalMinutes: { token: "breakIntervalMinutes", scope: ["apps/mobile/src/components/learning"] },
    },
  },
];

for (const platform of PLATFORMS) {
  const fields = extractFields(platform.schema, platform.block, platform.drop);
  if (fields.length === 0) continue;

  // 1. Every declared field must be registered in the proof manifest.
  for (const field of fields) {
    if (!(field in platform.proofs)) {
      errors.push(
        `${platform.name}: field "${field}" has no consumer proof registered in ` +
          `scripts/a11y/no-inert-prefs.mjs. Wire it into a render path and add its proof.`,
      );
    }
  }
  // 2. No stale manifest entries (renamed/removed fields).
  for (const field of Object.keys(platform.proofs)) {
    if (!fields.includes(field)) {
      errors.push(`${platform.name}: stale proof "${field}" — not a field on the schema anymore.`);
    }
  }
  // 3. Every registered proof must resolve to real, applied code.
  for (const field of fields) {
    const proof = platform.proofs[field];
    if (!proof) continue;
    const hit = findProof(proof.token, proof.scope, EXCLUDE);
    if (!hit) {
      errors.push(
        `${platform.name}: preference "${field}" is INERT — no consumer found ` +
          `(searched /${proof.token}/ in ${proof.scope.join(", ")}). ` +
          `It persists but never changes the lesson. Apply it or remove it.`,
      );
    } else {
      console.log(`  ✓ ${platform.name.split(" ")[0].padEnd(7)} ${field}  ⇐ ${hit}`);
    }
  }
}

if (errors.length) {
  console.error("\nno-inert-prefs FAILED:\n - " + errors.join("\n - "));
  process.exit(1);
}
console.log("\nno-inert-prefs OK — every accessibility preference has an applied consumer.");
