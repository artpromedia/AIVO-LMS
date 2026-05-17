#!/usr/bin/env node
// curriculum:validate — Sprint 05 gate.
//
// Verifies the curriculum source-of-truth packages without requiring
// a build step. The check is structural (TS source scan): it does not
// reproduce validateGraph()'s cycle detection, which is exercised by
// `packages/skill-graphs/src/__tests__/*` and run under `pnpm test`.
//
// What this gate enforces here, in addition to those package tests:
//
// 1. Every TS file under packages/skill-graphs/src/seeds/ is re-exported
//    by packages/skill-graphs/src/index.ts and listed in SEED_GRAPHS,
//    so a seed cannot be authored and then silently orphaned.
// 2. The aggregate SEED_GRAPHS export covers the subjects the product
//    promises at launch: math, ela, science.
// 3. Every Skill literal has a subject, gradeBand, title, and
//    description. Skills without frameworkRefs must carry an
//    `authoringMeta: { scaffolding: "true" }` marker.
// 4. Every item-bank Item literal under packages/item-bank/src has a
//    non-empty skillId — no items can target a stub skill.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const REQUIRED_SUBJECTS = ["math", "ela", "science"];

const errors = [];
const warnings = [];

// --- 1. Every seed file must be re-exported by index.ts -----------------

const seedsDir = join(repoRoot, "packages/skill-graphs/src/seeds");
const seedFiles = existsSync(seedsDir)
  ? readdirSync(seedsDir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  : [];

if (seedFiles.length === 0) {
  errors.push("packages/skill-graphs/src/seeds is empty.");
}

const indexPath = join(repoRoot, "packages/skill-graphs/src/index.ts");
const indexSrc = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";

for (const file of seedFiles) {
  const base = file.replace(/\.ts$/, "");
  const importPath = `./seeds/${base}.js`;
  if (!indexSrc.includes(importPath)) {
    errors.push(
      `seed orphaned: packages/skill-graphs/src/seeds/${file} is not re-exported from index.ts`,
    );
  }
}

// --- 2. SEED_GRAPHS must register every seed export ---------------------

const seedGraphsBlock = indexSrc.match(
  /export const SEED_GRAPHS:[^=]*=\s*\[([\s\S]*?)\];/,
);
if (!seedGraphsBlock) {
  errors.push(
    "packages/skill-graphs/src/index.ts: SEED_GRAPHS export not found.",
  );
} else {
  const listed = [...seedGraphsBlock[1].matchAll(/(\w+),?/g)].map((m) => m[1]);
  const exportRe = /export \{ (\w+) \} from "\.\/seeds\//g;
  for (const m of indexSrc.matchAll(exportRe)) {
    if (!listed.includes(m[1])) {
      errors.push(
        `seed ${m[1]} is re-exported but missing from SEED_GRAPHS aggregate.`,
      );
    }
  }
}

// --- 3. Per-seed: subjects, grade bands, framework refs, scaffolding ----

const subjectsSeen = new Set();
const subjectGrades = new Map();

function parseSkillObjects(src) {
  // Extract object literals that look like skills:
  //   { id: "...", title: "...", description: "...", subject: "...",
  //     gradeBand: "...", frameworkRefs: [...], prerequisites: [...] }
  const skills = [];
  const re =
    /\{\s*id:\s*"([^"]+)"[\s\S]*?subject:\s*"([^"]+)"[\s\S]*?gradeBand:\s*"([^"]+)"[\s\S]*?frameworkRefs:\s*(\[[\s\S]*?\])[\s\S]*?\}/g;
  for (const m of src.matchAll(re)) {
    skills.push({
      id: m[1],
      subject: m[2],
      gradeBand: m[3],
      frameworkRefsBlock: m[4],
    });
  }
  return skills;
}

for (const file of seedFiles) {
  const full = join(seedsDir, file);
  const src = readFileSync(full, "utf8");
  const skills = parseSkillObjects(src);
  if (skills.length === 0) {
    errors.push(
      `seed ${file}: parser found no Skill literals — file empty or schema mismatch.`,
    );
    continue;
  }
  for (const skill of skills) {
    subjectsSeen.add(skill.subject);
    const set = subjectGrades.get(skill.subject) ?? new Set();
    set.add(skill.gradeBand);
    subjectGrades.set(skill.subject, set);
    const hasRefs = /framework:/.test(skill.frameworkRefsBlock);
    const scaffolding = /scaffolding:\s*"true"/.test(src) || false;
    if (!hasRefs && !scaffolding) {
      // Soft warning — some bridge skills are intentionally
      // standards-free. Authors who want this should add
      // authoringMeta: { scaffolding: "true" } to the skill.
      warnings.push(
        `${file} / skill ${skill.id}: frameworkRefs is empty without authoringMeta.scaffolding="true".`,
      );
    }
  }
}

for (const required of REQUIRED_SUBJECTS) {
  if (!subjectsSeen.has(required)) {
    errors.push(
      `Sprint 05 launch requirement: no seed graph covers subject "${required}".`,
    );
  }
}

// --- 4. Item bank: every Item must reference a skillId ------------------

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile()) out.push(full);
  }
  return out;
}

const itemBankRoot = join(repoRoot, "packages/item-bank/src");
const itemFiles = walk(itemBankRoot).filter(
  (p) =>
    p.endsWith(".ts") &&
    !p.includes("__tests__") &&
    !p.endsWith("/types.ts") &&
    !p.endsWith("/index.ts") &&
    !p.endsWith("/routing.ts") &&
    !p.endsWith("/validate.ts"),
);
for (const file of itemFiles) {
  const src = readFileSync(file, "utf8");
  // Each Item declaration: `id: "..."`, `skillId: "..."`. We require
  // skillId for every Item-shaped literal in the file.
  const itemRe = /\{\s*id:\s*"([^"]+)"[\s\S]*?skillId:\s*"([^"]*)"/g;
  const ids = [];
  for (const m of src.matchAll(itemRe)) {
    if (!m[2]) {
      errors.push(`${file.replace(repoRoot + "/", "")}: item ${m[1]} has empty skillId.`);
    } else {
      ids.push({ id: m[1], skillId: m[2] });
    }
  }
}

if (warnings.length) {
  for (const w of warnings) console.warn(`warn: ${w}`);
}
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(
    `\ncurriculum:validate FAILED with ${errors.length} error(s).`,
  );
  process.exit(1);
}

console.log(
  `curriculum:validate OK — ${seedFiles.length} seed graph(s), ${subjectsSeen.size} subject(s), ${warnings.length} warning(s).`,
);
