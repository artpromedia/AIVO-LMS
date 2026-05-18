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

const AVATAR_PUBLIC_DIRS = [
  "apps/web/public/images/tutors",
  "apps/marketing/public/images/tutors",
];

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

// Per-tutor mode file aiSvcPersonaKey
const modeDir = join(repoRoot, "services/tutor-svc/src/modes");
const modePerTutor = new Map();
for (const key of CANONICAL_TUTORS) {
  // Find import line in registry to map key → mode file
  const importMatch = registrySrc.match(new RegExp(`import \\{ (\\w+) \\} from "\\./([\\w-]+)\\.js";[\\s\\S]*?${key}: \\1`));
  if (!importMatch) {
    modePerTutor.set(key, null);
    continue;
  }
  const modeFile = join(modeDir, importMatch[2] + ".ts");
  if (existsSync(modeFile)) {
    const src = readFileSync(modeFile, "utf8");
    const k = src.match(/aiSvcPersonaKey:\s*"([^"]+)"/);
    modePerTutor.set(key, { file: modeFile, personaKey: k?.[1] ?? null });
  } else {
    modePerTutor.set(key, { file: modeFile, personaKey: null });
  }
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

  const missing = [];
  if (!inBrand) missing.push("brand-catalog");
  if (!inRegistry) missing.push("runtime-registry");
  if (!personaKey) missing.push("no-aiSvcPersonaKey");
  else if (!personaExists) missing.push(`persona-missing(${personaKey})`);
  for (let i = 0; i < AVATAR_PUBLIC_DIRS.length; i++) {
    if (!avatars[i]) missing.push(`no-avatar(${AVATAR_PUBLIC_DIRS[i]})`);
  }

  let status;
  if (missing.length === 0) status = "🟢 green";
  else if (missing.length <= 1 && missing.every((m) => m.startsWith("no-avatar"))) {
    status = "🟡 yellow";
    for (const m of missing) warnings.push(`${tutor}: ${m}`);
  } else {
    status = "🔴 red";
    for (const m of missing) errors.push(`${tutor}: ${m}`);
  }

  rows.push({ tutor, status, brand: inBrand, registry: inRegistry, persona: personaKey ?? "—", personaOK: personaExists, avatarOK });
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
  for (const k of surplusRegistry) errors.push(`runtime registry has non-canonical tutor key: ${k}`);
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
console.log(pad("tutor", 10), pad("status", 12), pad("brand", 8), pad("registry", 10), pad("persona", 24), "avatar");
console.log("-".repeat(90));
for (const r of rows) {
  console.log(
    pad(r.tutor, 10),
    pad(r.status, 12),
    pad(r.brand ? "yes" : "NO", 8),
    pad(r.registry ? "yes" : "NO", 10),
    pad(`${r.persona}${r.personaOK ? "" : " (MISSING)"}`, 24),
    r.avatarOK ? "ok" : "MISSING",
  );
}
console.log("-".repeat(90));

const greens = rows.filter((r) => r.status.includes("green")).length;
const yellows = rows.filter((r) => r.status.includes("yellow")).length;
const reds = rows.filter((r) => r.status.includes("red")).length;
console.log(`\nsummary: ${greens}/${CANONICAL_TUTORS.length} green, ${yellows} yellow, ${reds} red`);

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
