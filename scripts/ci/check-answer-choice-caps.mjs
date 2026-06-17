#!/usr/bin/env node
/**
 * check-answer-choice-caps — pin the per-functioning-level answer-choice
 * caps so the three intentionally-different layers never silently disagree.
 *
 * The caps live in three layers (BASELINE-SPEC.md -> "Two caps, one
 * direction"):
 *
 *   1. Generator target — how many options the LLM is asked to author
 *      (services/ai-svc/.../baseline_generator.py -> fl_config[*].choices).
 *   2. Render cap — how many choice cards the learner ever sees, the single
 *      source of truth for the client (packages/learner-ui/.../fl-profiles.ts
 *      -> FL_PROFILES[*].maxChoices), mirrored by the mobile runner
 *      (apps/mobile/src/api/baselineClient.ts -> FL_MAX_CHOICES) and by the
 *      two dev-only web-v2 design-system previews, which hardcode their own
 *      copy of the cap (apps/web-v2/.../discovery|stage/*-preview-client.tsx
 *      -> FL_BITS[*].maxChoices).
 *   3. Server reject-above — the looser safety ceiling that rejects malformed
 *      LLM output before it reaches the client
 *      (services/ai-svc/.../scaffold_enforcer.py -> RULES[*].max_options).
 *
 * The documented invariant is:
 *
 *     generator target <= render cap <= server reject-above
 *
 * with PRE_SYMBOLIC as the deliberate exception: these learners never get a
 * multiple-choice baseline at all, so the generator target and the server
 * ceiling are both 0 (the enforcer rejects every MC item), while the render
 * cap stays a defensive non-zero default.
 *
 * Only the server ceiling is pinned by a unit test today; the render cap and
 * the generator target could drift apart or violate the invariant with
 * nothing failing. This pure-node ratchet runs in the lint-and-typecheck CI
 * job (which actually blocks the build) and fails loudly on any disagreement.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const SPEC_REF = "learner-experience/BASELINE-SPEC.md -> \"Two caps, one direction\"";

const LEVELS = ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"];

const FILES = {
  renderCap: "packages/learner-ui/src/tokens/fl-profiles.ts",
  mobileRenderCap: "apps/mobile/src/api/baselineClient.ts",
  baselinePreview:
    "apps/web-v2/app/design-system/discovery/baseline-preview-client.tsx",
  stagePreview: "apps/web-v2/app/design-system/stage/stage-preview-client.tsx",
  generator: "services/ai-svc/src/ai_svc/services/baseline_generator.py",
  serverCeiling: "services/ai-svc/src/ai_svc/services/scaffold_enforcer.py",
};

const errors = [];

function read(rel) {
  return readFileSync(join(repoRoot, rel), "utf8");
}

/** Ensure a parsed cap map has exactly one numeric entry per functioning level. */
function validateMap(label, map) {
  for (const level of LEVELS) {
    if (typeof map[level] !== "number" || !Number.isFinite(map[level])) {
      errors.push(
        `Could not parse the ${level} answer-choice cap from ${label} ` +
          `(${FILES[labelToFile(label)] ?? label}). The check's parser may be ` +
          `stale — update scripts/ci/check-answer-choice-caps.mjs alongside the source.`,
      );
    }
  }
  const extra = Object.keys(map).filter((k) => !LEVELS.includes(k));
  if (extra.length) {
    errors.push(
      `${label} declares unexpected functioning level(s) ${extra.join(", ")}; ` +
        `expected exactly ${LEVELS.join(", ")}. Keep every cap layer in lockstep (${SPEC_REF}).`,
    );
  }
}

function labelToFile(label) {
  return {
    "render cap (fl-profiles.ts)": "renderCap",
    "mobile render cap (baselineClient.ts FL_MAX_CHOICES)": "mobileRenderCap",
    "baseline preview render cap (baseline-preview-client.tsx FL_BITS)": "baselinePreview",
    "stage preview render cap (stage-preview-client.tsx FL_BITS)": "stagePreview",
    "generator target (baseline_generator.py fl_config)": "generator",
    "server reject-above (scaffold_enforcer.py RULES)": "serverCeiling",
  }[label];
}

/**
 * Render cap — FL_PROFILES[*].maxChoices. Each entry block carries no nested
 * braces, so a per-level `LEVEL: { ... maxChoices: N }` match is safe.
 */
function parseRenderCap() {
  const src = read(FILES.renderCap);
  const map = {};
  const re = new RegExp(
    `(${LEVELS.join("|")}):\\s*\\{[^}]*?maxChoices:\\s*(\\d+)`,
    "g",
  );
  let m;
  while ((m = re.exec(src)) !== null) map[m[1]] = Number(m[2]);
  return map;
}

/**
 * Preview render cap — FL_BITS[*].maxChoices in the two dev-only web-v2
 * design-system previews. Each entry is a single-line object literal with no
 * nested braces, so the same per-level `LEVEL: { ... maxChoices: N }` match is
 * safe as for the canonical render cap.
 */
function parsePreviewCap(fileKey) {
  const src = read(FILES[fileKey]);
  const map = {};
  const re = new RegExp(
    `(${LEVELS.join("|")}):\\s*\\{[^}]*?maxChoices:\\s*(\\d+)`,
    "g",
  );
  let m;
  while ((m = re.exec(src)) !== null) map[m[1]] = Number(m[2]);
  return map;
}

/** Mobile render cap — the FL_MAX_CHOICES record literal. */
function parseMobileRenderCap() {
  const src = read(FILES.mobileRenderCap);
  const block = src.match(/FL_MAX_CHOICES[^=]*=\s*\{([\s\S]*?)\};/);
  const map = {};
  if (!block) return map;
  const re = new RegExp(`(${LEVELS.join("|")}):\\s*(\\d+)`, "g");
  let m;
  while ((m = re.exec(block[1])) !== null) map[m[1]] = Number(m[2]);
  return map;
}

/** Generator target — fl_config[*].choices (single-line dict literals). */
function parseGeneratorTarget() {
  const src = read(FILES.generator);
  const map = {};
  const re = new RegExp(
    `"(${LEVELS.join("|")})":\\s*\\{[^}]*?"choices":\\s*(\\d+)`,
    "g",
  );
  let m;
  while ((m = re.exec(src)) !== null) map[m[1]] = Number(m[2]);
  return map;
}

/** Server reject-above — RULES[*].max_options inside each ScaffoldRule(...). */
function parseServerCeiling() {
  const src = read(FILES.serverCeiling);
  const map = {};
  const re = new RegExp(
    `"(${LEVELS.join("|")})":\\s*ScaffoldRule\\([^()]*?max_options=(\\d+|None)`,
    "g",
  );
  let m;
  while ((m = re.exec(src)) !== null) {
    map[m[1]] = m[2] === "None" ? Infinity : Number(m[2]);
  }
  return map;
}

const TEXT_WEIGHTS = ["full", "reduced", "icons-primary", "icons-only", "none"];

/**
 * Per-functioning-level layout bits beyond the render cap. Both the canonical
 * profile (FL_PROFILES[*] in fl-profiles.ts) and the two preview FL_BITS maps
 * carry their entries as a single `LEVEL: { ... }` block with no nested braces,
 * so a per-level block grab + field match is safe for either source.
 */
function parseProfileFields(fileKey) {
  const src = read(FILES[fileKey]);
  const textWeight = {};
  const hitTarget = {};
  for (const level of LEVELS) {
    const block = src.match(new RegExp(`${level}:\\s*\\{([^}]*)\\}`));
    if (!block) continue;
    const tw = block[1].match(/textWeight:\s*"([^"]+)"/);
    const ht = block[1].match(/hitTarget:\s*(\d+)/);
    if (tw) textWeight[level] = tw[1];
    if (ht) hitTarget[level] = Number(ht[1]);
  }
  return { textWeight, hitTarget };
}

/** Ensure a parsed textWeight map has a known enum value per functioning level. */
function validateTextWeightMap(label, map) {
  for (const level of LEVELS) {
    if (!TEXT_WEIGHTS.includes(map[level])) {
      errors.push(
        `Could not parse the ${level} textWeight from ${label} ` +
          `(${FILES[labelToFile(label)] ?? label}). The check's parser may be ` +
          `stale — update scripts/ci/check-answer-choice-caps.mjs alongside the source.`,
      );
    }
  }
}

const renderCap = parseRenderCap();
const mobileRenderCap = parseMobileRenderCap();
const baselinePreviewCap = parsePreviewCap("baselinePreview");
const stagePreviewCap = parsePreviewCap("stagePreview");
const generatorTarget = parseGeneratorTarget();
const serverCeiling = parseServerCeiling();

const canonicalFields = parseProfileFields("renderCap");
const baselinePreviewFields = parseProfileFields("baselinePreview");
const stagePreviewFields = parseProfileFields("stagePreview");

validateMap("render cap (fl-profiles.ts)", renderCap);
validateMap("mobile render cap (baselineClient.ts FL_MAX_CHOICES)", mobileRenderCap);
validateMap("baseline preview render cap (baseline-preview-client.tsx FL_BITS)", baselinePreviewCap);
validateMap("stage preview render cap (stage-preview-client.tsx FL_BITS)", stagePreviewCap);
validateMap("generator target (baseline_generator.py fl_config)", generatorTarget);
validateMap("server reject-above (scaffold_enforcer.py RULES)", serverCeiling);

validateTextWeightMap("textWeight (fl-profiles.ts)", canonicalFields.textWeight);
validateTextWeightMap("baseline preview textWeight (baseline-preview-client.tsx FL_BITS)", baselinePreviewFields.textWeight);
validateTextWeightMap("stage preview textWeight (stage-preview-client.tsx FL_BITS)", stagePreviewFields.textWeight);
validateMap("hitTarget (fl-profiles.ts)", canonicalFields.hitTarget);
validateMap("baseline preview hitTarget (baseline-preview-client.tsx FL_BITS)", baselinePreviewFields.hitTarget);
validateMap("stage preview hitTarget (stage-preview-client.tsx FL_BITS)", stagePreviewFields.hitTarget);

// Bail before the comparisons if any layer failed to parse — comparing
// `undefined` would produce confusing secondary errors.
if (errors.length === 0) {
  for (const level of LEVELS) {
    const render = renderCap[level];
    const mobile = mobileRenderCap[level];
    const baselinePreview = baselinePreviewCap[level];
    const stagePreview = stagePreviewCap[level];
    const gen = generatorTarget[level];
    const server = serverCeiling[level];

    // (a) Render cap is a single source of truth: web and mobile must agree.
    if (render !== mobile) {
      errors.push(
        `${level}: render cap disagrees between web and mobile — ` +
          `fl-profiles.ts maxChoices=${render} but baselineClient.ts FL_MAX_CHOICES=${mobile}. ` +
          `These must be identical (single source of truth; ${SPEC_REF}).`,
      );
    }

    // (a2) The dev-only web-v2 design-system previews hardcode their own copy
    // of the render cap; keep them mirroring fl-profiles.ts so the preview can
    // never misrepresent how many choices a learner actually sees.
    if (render !== baselinePreview) {
      errors.push(
        `${level}: baseline preview render cap drifted from the source of truth — ` +
          `fl-profiles.ts maxChoices=${render} but baseline-preview-client.tsx FL_BITS=${baselinePreview}. ` +
          `Update FL_BITS in apps/web-v2/app/design-system/discovery/baseline-preview-client.tsx ` +
          `to match (previews mirror the single render cap; ${SPEC_REF}).`,
      );
    }
    if (render !== stagePreview) {
      errors.push(
        `${level}: stage preview render cap drifted from the source of truth — ` +
          `fl-profiles.ts maxChoices=${render} but stage-preview-client.tsx FL_BITS=${stagePreview}. ` +
          `Update FL_BITS in apps/web-v2/app/design-system/stage/stage-preview-client.tsx ` +
          `to match (previews mirror the single render cap; ${SPEC_REF}).`,
      );
    }

    // (a3) textWeight drives real preview behavior (icons-only/none hides the
    // choice labels, full/reduced shows them), so a drift here gives a
    // misleading demo. It must match the canonical profile EXACTLY.
    const canonTextWeight = canonicalFields.textWeight[level];
    if (canonTextWeight !== baselinePreviewFields.textWeight[level]) {
      errors.push(
        `${level}: baseline preview textWeight drifted from the source of truth — ` +
          `fl-profiles.ts textWeight="${canonTextWeight}" but ` +
          `baseline-preview-client.tsx FL_BITS="${baselinePreviewFields.textWeight[level]}". ` +
          `Update FL_BITS in apps/web-v2/app/design-system/discovery/baseline-preview-client.tsx ` +
          `to match (textWeight changes what the learner sees; ${SPEC_REF}).`,
      );
    }
    if (canonTextWeight !== stagePreviewFields.textWeight[level]) {
      errors.push(
        `${level}: stage preview textWeight drifted from the source of truth — ` +
          `fl-profiles.ts textWeight="${canonTextWeight}" but ` +
          `stage-preview-client.tsx FL_BITS="${stagePreviewFields.textWeight[level]}". ` +
          `Update FL_BITS in apps/web-v2/app/design-system/stage/stage-preview-client.tsx ` +
          `to match (textWeight changes what the learner sees; ${SPEC_REF}).`,
      );
    }

    // (a4) hitTarget (tap-target px) is INTENTIONALLY enlarged in the previews
    // so the demo reads on a desktop display, so we do not require equality.
    // But a preview tap target must never be SMALLER than the real one — that
    // would understate the accessibility the learner actually gets. Pin the
    // documented relationship: preview hitTarget >= canonical hitTarget.
    const canonHit = canonicalFields.hitTarget[level];
    if (!(baselinePreviewFields.hitTarget[level] >= canonHit)) {
      errors.push(
        `${level}: baseline preview hitTarget is smaller than the real tap target — ` +
          `fl-profiles.ts hitTarget=${canonHit} but ` +
          `baseline-preview-client.tsx FL_BITS=${baselinePreviewFields.hitTarget[level]}. ` +
          `The preview may enlarge tap targets but must never shrink below the canonical value ` +
          `(it would understate accessibility; ${SPEC_REF}).`,
      );
    }
    if (!(stagePreviewFields.hitTarget[level] >= canonHit)) {
      errors.push(
        `${level}: stage preview hitTarget is smaller than the real tap target — ` +
          `fl-profiles.ts hitTarget=${canonHit} but ` +
          `stage-preview-client.tsx FL_BITS=${stagePreviewFields.hitTarget[level]}. ` +
          `The preview may enlarge tap targets but must never shrink below the canonical value ` +
          `(it would understate accessibility; ${SPEC_REF}).`,
      );
    }

    if (level === "PRE_SYMBOLIC") {
      // (b) PRE_SYMBOLIC exception: no multiple-choice baseline at all, so the
      // generator authors nothing and the server rejects every MC item.
      if (gen !== 0) {
        errors.push(
          `PRE_SYMBOLIC: generator target must be 0 (these learners get an ` +
            `observation checklist, never MC) but baseline_generator.py choices=${gen}. (${SPEC_REF}).`,
        );
      }
      if (server !== 0) {
        errors.push(
          `PRE_SYMBOLIC: server reject-above must be 0 (the enforcer rejects ` +
            `every MC item) but scaffold_enforcer.py max_options=${fmt(server)}. (${SPEC_REF}).`,
        );
      }
      continue;
    }

    // (c) The core invariant: generator target <= render cap <= server reject-above.
    if (!(gen <= render)) {
      errors.push(
        `${level}: generator target (${gen}) exceeds render cap (${render}). ` +
          `The LLM is asked for more options than the learner can ever see. ` +
          `Invariant: generator target <= render cap <= server reject-above (${SPEC_REF}).`,
      );
    }
    if (!(render <= server)) {
      errors.push(
        `${level}: render cap (${render}) exceeds server reject-above (${fmt(server)}). ` +
          `The client would try to render options the server should have rejected. ` +
          `Invariant: generator target <= render cap <= server reject-above (${SPEC_REF}).`,
      );
    }
  }
}

function fmt(n) {
  return n === Infinity ? "None (no limit)" : String(n);
}

if (errors.length) {
  console.error("check-answer-choice-caps FAILED — answer-choice caps disagree:\n");
  for (const e of errors) console.error("  - " + e);
  console.error(
    `\nThe per-functioning-level caps span three layers and must satisfy\n` +
      `  generator target <= render cap <= server reject-above\n` +
      `(PRE_SYMBOLIC excepted: no MC at all -> generator + server both 0).\n` +
      `Fix the offending value in its source file, then re-run. See ${SPEC_REF}.`,
  );
  process.exit(1);
}

console.log("check-answer-choice-caps OK — caps agree across all layers:");
for (const level of LEVELS) {
  console.log(
    `  ${level.padEnd(13)} generator ${generatorTarget[level]}` +
      ` <= render ${renderCap[level]} (web=mobile=previews)` +
      ` <= server ${fmt(serverCeiling[level])}`,
  );
}
console.log(
  "\ncheck-answer-choice-caps OK — preview layout bits agree with fl-profiles.ts:",
);
for (const level of LEVELS) {
  console.log(
    `  ${level.padEnd(13)} textWeight "${canonicalFields.textWeight[level]}" (web=previews)` +
      `  hitTarget canonical ${canonicalFields.hitTarget[level]}` +
      ` <= preview ${baselinePreviewFields.hitTarget[level]} (baseline) /` +
      ` ${stagePreviewFields.hitTarget[level]} (stage)`,
  );
}
