#!/usr/bin/env node
// accessibility:audit — Sprint 15 gate.
//
// Verifies the accessibility contract in
// docs/accessibility/vpat-readiness.md:
//
// 1. AccessibilityPreferences declares every preference field.
// 2. ACCESSIBILITY_DEFAULTS provides a default for each.
// 3. lib/tts/provider.ts exports the canonical helpers.
// 4. packages/aac-bridge/src/index.ts re-exports the canonical AAC
//    primitives.
// 5. Accessibility + TTS BFFs exist.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const errors = [];

const REQUIRED_PREFS = [
  "reducedMotion",
  "highContrast",
  "largeText",
  "audioFirst",
  "captionsAlwaysOn",
  "hapticsEnabled",
  "readAloud",
  "dyslexiaFriendlyFont",
  "shorterSteps",
  "extraHints",
  "visualSupports",
  "breakReminders",
  "keyboardOptimized",
];

const typesPath = join(repoRoot, "apps/web-v2/lib/db/types.ts");
if (!existsSync(typesPath)) {
  errors.push("apps/web-v2/lib/db/types.ts missing.");
} else {
  const src = readFileSync(typesPath, "utf8");
  const prefsBlock = src.match(
    /export type AccessibilityPreferences\s*=\s*\{([\s\S]*?)\};/,
  );
  if (!prefsBlock) {
    errors.push("AccessibilityPreferences type not found.");
  } else {
    const body = prefsBlock[1];
    for (const field of REQUIRED_PREFS) {
      const re = new RegExp(`\\b${field}:`);
      if (!re.test(body)) {
        errors.push(
          `AccessibilityPreferences missing field "${field}".`,
        );
      }
    }
  }
  const defaultsBlock = src.match(
    /export const ACCESSIBILITY_DEFAULTS[^=]*=\s*\{([\s\S]*?)\};/,
  );
  if (!defaultsBlock) {
    errors.push("ACCESSIBILITY_DEFAULTS constant not found.");
  } else {
    const body = defaultsBlock[1];
    for (const field of REQUIRED_PREFS) {
      const re = new RegExp(`\\b${field}:`);
      if (!re.test(body)) {
        errors.push(
          `ACCESSIBILITY_DEFAULTS missing default for "${field}".`,
        );
      }
    }
  }
}

// --- 3. TTS provider exports ----------------------------------------

const ttsPath = join(repoRoot, "apps/web-v2/lib/tts/provider.ts");
if (!existsSync(ttsPath)) {
  errors.push("apps/web-v2/lib/tts/provider.ts missing.");
} else {
  const src = readFileSync(ttsPath, "utf8");
  for (const exp of [
    "ttsContentHash",
    "getTTSProvider",
    "mockTTSProvider",
    "productionTTSAdapter",
  ]) {
    const re = new RegExp(`export (?:function|const) ${exp}\\b`);
    if (!re.test(src)) {
      errors.push(`lib/tts/provider.ts: missing export ${exp}.`);
    }
  }
}

// --- 4. AAC bridge canonical exports -------------------------------

const aacPath = join(repoRoot, "packages/aac-bridge/src/index.ts");
if (!existsSync(aacPath)) {
  errors.push("packages/aac-bridge/src/index.ts missing.");
} else {
  const src = readFileSync(aacPath, "utf8");
  const REQUIRED_AAC = [
    "SwitchScanController",
    "useAACInput",
    "parseOBF",
    "exportToOBF",
    "PRCSaltilloAdapter",
    "TobiiAdapter",
    "AssistiveWareAdapter",
    "detectAndCreateAdapter",
    "CalibrationState",
    "GazeTargetMapper",
    "DwellClickController",
  ];
  for (const exp of REQUIRED_AAC) {
    if (!new RegExp(`\\b${exp}\\b`).test(src)) {
      errors.push(`aac-bridge/index.ts: missing re-export ${exp}.`);
    }
  }
}

// --- 5. BFF routes -------------------------------------------------

const REQUIRED_BFF = [
  "apps/web-v2/app/api/bff/learners/[learnerId]/accessibility/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/accessibility/reset/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/tts/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/tts/prewarm/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/tts/[audioAssetId]/route.ts",
];
for (const rel of REQUIRED_BFF) {
  if (!existsSync(join(repoRoot, rel))) {
    errors.push(`missing accessibility/TTS BFF: ${rel}`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(
    `\naccessibility:audit FAILED with ${errors.length} error(s).`,
  );
  process.exit(1);
}

console.log(
  `accessibility:audit OK — ${REQUIRED_PREFS.length} preferences + defaults, TTS provider, AAC bridge re-exports, accessibility + TTS BFFs verified.`,
);
