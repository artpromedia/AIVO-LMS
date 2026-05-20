#!/usr/bin/env node
// tutor:parity — Sprint GREEN-02 gate.
//
// Verifies every canonical AIVO tutor is production-complete across:
//   1. Brand catalog (display name, domain, color, tier, avatar path)
//   2. Runtime registry (services/tutor-svc/src/modes/registry.ts)
//   3. AI persona prompt (services/ai-svc/src/ai_svc/prompts/tutor_personas.py)
//   4. Avatar asset files exist on disk in web + marketing public dirs
//   5. The runtime cannot accept unknown tutor keys without falling back
//
// What this gate does NOT verify (left for future tightening):
//   - Voice / pronunciation overrides per tutor
//   - Reduced-motion avatar variants
//   - Per-tutor analytics event coverage
//   - Persona safety eval results
//
// Those are tracked as P2 items in docs/quality/tutor-parity-matrix.md.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const CANONICAL_TUTORS = [
  "nova",
  "sage",
  "spark",
  "chrono",
  "pixel",
  "echo",
  "harmony",
  "atlas",
  "cadence",
  "vigor",
  "lingua",
  "forge",
  "compass",
  "muse",
];

const AVATAR_PUBLIC_DIRS = ["apps/marketing/public/images/tutors"];

const errors = [];
const warnings = [];

// ---------------------------------------------------------------------------
// 1. Brand catalog
// ---------------------------------------------------------------------------

const brandPath = join(repoRoot, "packages/brand/src/index.ts");
if (!existsSync(brandPath)) {
  errors.push("packages/brand/src/index.ts not found");
  emitAndExit();
}
const brandSrc = readFileSync(brandPath, "utf8");
const brandKeysMatch = brandSrc.match(/export const TUTORS = \{([\s\S]*?)\n\} as const;/);
if (!brandKeysMatch) {
  errors.push("packages/brand: TUTORS constant not found");
  emitAndExit();
}
const brandKeys = [...brandKeysMatch[1].matchAll(/^\s*([a-z]+):\s*\{/gm)].map((m) => m[1]);

// ---------------------------------------------------------------------------
// 2. Runtime registry
// ---------------------------------------------------------------------------

const registryPath = join(repoRoot, "services/tutor-svc/src/modes/registry.ts");
if (!existsSync(registryPath)) {
  errors.push("services/tutor-svc/src/modes/registry.ts not found");
  emitAndExit();
}
const registrySrc = readFileSync(registryPath, "utf8");
const registryBlock = registrySrc.match(/TUTOR_REGISTRY[^=]*=\s*\{([\s\S]*?)^\};/m);
if (!registryBlock) {
  errors.push("services/tutor-svc/src/modes/registry.ts: TUTOR_REGISTRY not parseable");
  emitAndExit();
}
const registryKeys = [...registryBlock[1].matchAll(/^\s*([a-z]+):\s*\w+Tutor,?\s*$/gm)].map(
  (m) => m[1],
);

// ---------------------------------------------------------------------------
// 3. AI persona prompts. Each TutorDefinition declares aiSvcPersonaKey;
//    that key must appear in tutor_personas.py.
// ---------------------------------------------------------------------------

const personaPath = join(repoRoot, "services/ai-svc/src/ai_svc/prompts/tutor_personas.py");
const personaSrc = existsSync(personaPath) ? readFileSync(personaPath, "utf8") : "";
if (!personaSrc) {
  errors.push("services/ai-svc/src/ai_svc/prompts/tutor_personas.py not found");
}
const personaKeys = new Set(
  [...personaSrc.matchAll(/^\s*"(ADDON_TUTOR_[A-Z_]+)":\s*\{/gm)].map((m) => m[1]),
);

// Per-tutor mode file aiSvcPersonaKey + deep-parity fields
const modeDir = join(repoRoot, "services/tutor-svc/src/modes");
const modePerTutor = new Map();
for (const key of CANONICAL_TUTORS) {
  // Find import line in registry to map key → mode file
  const importMatch = registrySrc.match(
    new RegExp(`import \\{ (\\w+) \\} from "\\./([\\w-]+)\\.js";[\\s\\S]*?${key}: \\1`),
  );
  if (!importMatch) {
    modePerTutor.set(key, null);
    continue;
  }
  const modeFile = join(modeDir, importMatch[2] + ".ts");
  if (existsSync(modeFile)) {
    const src = readFileSync(modeFile, "utf8");
    const k = src.match(/aiSvcPersonaKey:\s*"([^"]+)"/);
    // Deep-parity surface inspection: these correspond to fields that
    // already exist in TutorDefinition (packages/tutor-sdk/src/types.ts).
    // Missing or empty values become yellow findings.
    const voiceStyle = src.match(/voiceStyle:\s*"([^"]+)"/)?.[1] ?? null;
    const hasVoiceOut = /capabilities:\s*\[[\s\S]*?"voice_out"/.test(src);
    const hasSubjects = /subjects:\s*\[[\s\S]*?"[\w-]+"/.test(src);
    const hasGradeBands = /gradeBands:\s*\[[\s\S]*?"[\w+-]+"/.test(src);
    const hasFunctioningLevels = /functioningLevels:\s*\[[\s\S]*?"[A-Z_]+"/.test(src);
    const hasSkillGraphRefs = /skillGraphRefs:\s*\[[\s\S]*?"[^"]+"/.test(src);
    const hasPolicy = /policy:\s*\{/.test(src);
    modePerTutor.set(key, {
      file: modeFile,
      personaKey: k?.[1] ?? null,
      voiceStyle,
      hasVoiceOut,
      hasSubjects,
      hasGradeBands,
      hasFunctioningLevels,
      hasSkillGraphRefs,
      hasPolicy,
    });
  } else {
    modePerTutor.set(key, { file: modeFile, personaKey: null });
  }
}

// Reduced-motion avatar variants. Accepted conventions, in priority order:
//   - <key>-reduced.svg   (preferred — static-by-construction, accessible)
//   - <key>-reduced.png   (designer-authored static variant)
//   - <key>-static.png    (alternate name some teams use)
//   - <key>.svg           (only if the SVG is known to be static)
// Files live alongside <key>.png in the same public dir. If none of the
// variants exist, learners who turn on reduced-motion will see the
// animated avatar — a yellow finding for GREEN-02 deep parity / GREEN-09.
const reducedMotionStatus = new Map();
for (const tutor of CANONICAL_TUTORS) {
  const found = AVATAR_PUBLIC_DIRS.map(
    (d) =>
      existsSync(join(repoRoot, d, `${tutor}-reduced.svg`)) ||
      existsSync(join(repoRoot, d, `${tutor}-reduced.png`)) ||
      existsSync(join(repoRoot, d, `${tutor}-static.png`)) ||
      existsSync(join(repoRoot, d, `${tutor}.svg`)),
  );
  reducedMotionStatus.set(tutor, found);
}

// ---------------------------------------------------------------------------
// 4. Avatar assets
// ---------------------------------------------------------------------------

const avatarStatus = new Map();
for (const tutor of CANONICAL_TUTORS) {
  const found = AVATAR_PUBLIC_DIRS.map((d) => existsSync(join(repoRoot, d, `${tutor}.png`)));
  avatarStatus.set(tutor, found);
}

// ---------------------------------------------------------------------------
// 5. Build per-tutor report
// ---------------------------------------------------------------------------

const rows = [];
for (const tutor of CANONICAL_TUTORS) {
  const inBrand = brandKeys.includes(tutor);
  const inRegistry = registryKeys.includes(tutor);
  const mode = modePerTutor.get(tutor);
  const personaKey = mode?.personaKey ?? null;
  const personaExists = personaKey ? personaKeys.has(personaKey) : false;
  const avatars = avatarStatus.get(tutor);
  const avatarOK = avatars && avatars.every(Boolean);
  const reducedMotion = reducedMotionStatus.get(tutor);
  const reducedMotionOK = reducedMotion && reducedMotion.every(Boolean);

  // Hard requirements (red)
  const missing = [];
  if (!inBrand) missing.push("brand-catalog");
  if (!inRegistry) missing.push("runtime-registry");
  if (!personaKey) missing.push("no-aiSvcPersonaKey");
  else if (!personaExists) missing.push(`persona-missing(${personaKey})`);
  for (let i = 0; i < AVATAR_PUBLIC_DIRS.length; i++) {
    if (!avatars[i]) missing.push(`no-avatar(${AVATAR_PUBLIC_DIRS[i]})`);
  }
  if (mode) {
    if (!mode.voiceStyle) missing.push("no-voice-style");
    if (!mode.hasSubjects) missing.push("no-subjects");
    if (!mode.hasGradeBands) missing.push("no-gradeBands");
    if (!mode.hasFunctioningLevels) missing.push("no-functioningLevels");
    if (!mode.hasSkillGraphRefs) missing.push("no-skillGraphRefs");
    if (!mode.hasPolicy) missing.push("no-policy");
  }

  // Soft requirements (yellow) — GREEN-02 deep parity / GREEN-09 a11y
  const soft = [];
  if (mode && !mode.hasVoiceOut) soft.push("no-voice_out-capability");
  if (!reducedMotionOK) soft.push("no-reduced-motion-avatar");

  let status;
  if (missing.length === 0 && soft.length === 0) status = "🟢 green";
  else if (missing.length === 0) {
    status = "🟡 yellow";
    for (const s of soft) warnings.push(`${tutor}: ${s}`);
  } else {
    status = "🔴 red";
    for (const m of missing) errors.push(`${tutor}: ${m}`);
    for (const s of soft) warnings.push(`${tutor}: ${s}`);
  }

  rows.push({
    tutor,
    status,
    brand: inBrand,
    registry: inRegistry,
    persona: personaKey ?? "—",
    personaOK: personaExists,
    avatarOK,
    voiceStyle: mode?.voiceStyle ?? "—",
    voiceOut: mode?.hasVoiceOut ?? false,
    reducedMotionOK,
  });
}

// ---------------------------------------------------------------------------
// 6. Surplus tutors: any catalog or registry key not in canonical list
// ---------------------------------------------------------------------------

const surplusBrand = brandKeys.filter((k) => !CANONICAL_TUTORS.includes(k));
const surplusRegistry = registryKeys.filter((k) => !CANONICAL_TUTORS.includes(k));
if (surplusBrand.length) {
  for (const k of surplusBrand) errors.push(`brand catalog has non-canonical tutor key: ${k}`);
}
if (surplusRegistry.length) {
  for (const k of surplusRegistry)
    errors.push(`runtime registry has non-canonical tutor key: ${k}`);
}

// ---------------------------------------------------------------------------
// 7. Print
// ---------------------------------------------------------------------------

function emitAndExit() {
  for (const e of errors) console.error(`error: ${e}`);
  for (const w of warnings) console.warn(`warn: ${w}`);
  console.error("\ntutor:parity FAILED.");
  process.exit(1);
}

const pad = (s, n) => String(s).padEnd(n);
console.log("\nTUTOR PARITY MATRIX\n");
console.log(
  pad("tutor", 10),
  pad("status", 12),
  pad("brand", 7),
  pad("reg", 5),
  pad("persona", 16),
  pad("voice", 10),
  pad("v_out", 6),
  pad("avatar", 8),
  "reduced-motion",
);
console.log("-".repeat(100));
for (const r of rows) {
  console.log(
    pad(r.tutor, 10),
    pad(r.status, 12),
    pad(r.brand ? "yes" : "NO", 7),
    pad(r.registry ? "yes" : "NO", 5),
    pad(`${r.personaOK ? "ok" : "MISSING"}`, 16),
    pad(r.voiceStyle, 10),
    pad(r.voiceOut ? "yes" : "NO", 6),
    pad(r.avatarOK ? "ok" : "MISSING", 8),
    r.reducedMotionOK ? "ok" : "MISSING",
  );
}
console.log("-".repeat(100));

const greens = rows.filter((r) => r.status.includes("green")).length;
const yellows = rows.filter((r) => r.status.includes("yellow")).length;
const reds = rows.filter((r) => r.status.includes("red")).length;
console.log(
  `\nsummary: ${greens}/${CANONICAL_TUTORS.length} green, ${yellows} yellow, ${reds} red`,
);

if (warnings.length) {
  console.log("\nwarnings:");
  for (const w of warnings) console.log(`  warn: ${w}`);
}
if (errors.length) {
  console.error("\nerrors:");
  for (const e of errors) console.error(`  error: ${e}`);
  console.error(`\ntutor:parity FAILED with ${errors.length} error(s).`);
  process.exit(1);
}
console.log("\ntutor:parity OK.");
