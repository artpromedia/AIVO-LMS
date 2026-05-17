#!/usr/bin/env node
// Sprint 04 one-shot remediation: add requireLearnerConsent guards to
// every sensitive learner BFF route flagged by consent:audit.
//
// This script is intentionally tucked under scripts/internal so it is
// not exposed as a regular root script — it is a migration tool, not
// an ongoing gate. After running it once, the gate is consent:audit.

import {
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");

// Route family → consent types required, mirroring consent-matrix.md.
const ROUTE_FAMILIES = [
  { match: /\/iep-upload\//, types: ["iep_document_storage", "child_data_collection"] },
  { match: /\/brain-profile\//, types: ["ai_personalization", "child_data_collection"] },
  { match: /\/parent-assessment\//, types: ["child_data_collection"] },
  { match: /\/baseline\//, types: ["child_data_collection"] },
  { match: /\/mastery\//, types: ["child_data_collection"] },
  { match: /\/progress\//, types: ["child_data_collection"] },
  { match: /\/readiness\//, types: ["child_data_collection"] },
  { match: /\/lesson-runs\//, types: ["child_data_collection", "ai_personalization"] },
  { match: /\/missions\//, types: ["child_data_collection", "ai_personalization"] },
  { match: /\/homework\//, types: ["child_data_collection", "ai_personalization"] },
  { match: /\/tts\//, types: ["child_data_collection"] },
  { match: /\/context\//, types: ["child_data_collection", "ai_personalization"] },
  { match: /\/accessibility\//, types: ["child_data_collection"] },
  { match: /\/audio-preferences\//, types: ["child_data_collection"] },
  { match: /\/learning-path\//, types: ["child_data_collection", "ai_personalization"] },
  { match: /\/quests\//, types: ["child_data_collection", "ai_personalization"] },
  { match: /\/subjects\//, types: ["child_data_collection"] },
  { match: /\/today\//, types: ["child_data_collection", "ai_personalization"] },
  // The /learners/[learnerId]/route.ts profile read+write itself
  { match: /\/learners\/\[learnerId\]\/route\.ts$/, types: ["child_data_collection"] },
];

const TARGETS = [
  "apps/web-v2/app/api/bff/learners/[learnerId]/accessibility/reset/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/accessibility/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/baseline/[baselineId]/answer/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/baseline/[baselineId]/complete/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/baseline/[baselineId]/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/baseline/[baselineId]/start/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/baseline/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/brain-profile/regenerate/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/brain-profile/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/context/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/homework/[sessionId]/complete/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/homework/[sessionId]/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/iep-upload/extract/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/iep-upload/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/iep-upload/skip/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/lesson-runs/[lessonRunId]/complete/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/lesson-runs/[lessonRunId]/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/lesson-runs/[lessonRunId]/start/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/lesson-runs/[lessonRunId]/step/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/mastery/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/parent-assessment/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/parent-assessment/submit/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/progress/recalculate/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/progress/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/readiness/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/tts/[audioAssetId]/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/tts/prewarm/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/tts/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/audio-preferences/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/learning-path/generate/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/learning-path/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/quests/[worldId]/chapters/[chapterId]/complete/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/quests/[worldId]/chapters/[chapterId]/start/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/quests/[worldId]/progress/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/quests/[worldId]/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/quests/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/subjects/[subjectId]/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/subjects/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/today/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/today/start/route.ts",
];

function consentTypesFor(rel) {
  for (const fam of ROUTE_FAMILIES) {
    if (fam.match.test(rel)) return fam.types;
  }
  return null;
}

let patched = 0;
let skipped = 0;
const errors = [];

for (const rel of TARGETS) {
  const full = join(repoRoot, rel);
  if (!existsSync(full)) {
    errors.push(`missing: ${rel}`);
    continue;
  }
  const types = consentTypesFor(rel);
  if (!types) {
    errors.push(`no family match: ${rel}`);
    continue;
  }
  let src = readFileSync(full, "utf8");
  if (/requireLearnerConsent\(/.test(src)) {
    skipped++;
    continue;
  }
  // Add import. Insert next to the existing guards import.
  if (!/from "@\/lib\/bff\/consent-guard"/.test(src)) {
    const importLine = `import { requireLearnerConsent } from "@/lib/bff/consent-guard";\n`;
    const guardsImportIdx = src.indexOf('from "@/lib/bff/guards"');
    if (guardsImportIdx === -1) {
      errors.push(`no guards import in ${rel}; manual patch needed`);
      continue;
    }
    const lineEnd = src.indexOf("\n", guardsImportIdx) + 1;
    src = src.slice(0, lineEnd) + importLine + src.slice(lineEnd);
  }
  // Insert the consent guard after every requireLearnerScope block.
  const typesLiteral = `[${types.map((t) => JSON.stringify(t)).join(", ")}]`;
  // Match the closing of requireLearnerScope: `if (scope) return scope;`
  // Match either `const scope = ...; if (scope) return scope;`
  // or `const scopeErr = ...; if (scopeErr) return scopeErr;` patterns.
  const scopeBlockRe =
    /(const (scope|scopeErr) = requireLearnerScope\(session!, learnerId, requestId\);\s*\n\s*if \((scope|scopeErr)\) return (scope|scopeErr);)/g;
  let matched = false;
  src = src.replace(scopeBlockRe, (m) => {
    matched = true;
    return (
      m +
      `\n    const consentErr = requireLearnerConsent(session!, learnerId, ${typesLiteral}, requestId);\n    if (consentErr) return consentErr;`
    );
  });
  if (!matched) {
    errors.push(`no requireLearnerScope block found in ${rel}; manual patch needed`);
    continue;
  }
  writeFileSync(full, src, "utf8");
  patched++;
}

console.log(
  `apply-consent-guards: patched=${patched} skipped=${skipped} errors=${errors.length}`,
);
if (errors.length) {
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
