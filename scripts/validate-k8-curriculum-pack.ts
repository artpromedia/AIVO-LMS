#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateK8CurriculumPack } from "../packages/curriculum-authoring/src/index.js";

const file = process.argv[2] ?? "curriculum/k8/sample-pack.json";
const path = resolve(process.cwd(), file);
const raw = JSON.parse(readFileSync(path, "utf8"));
const result = validateK8CurriculumPack(raw);

if (!result.ok) {
  for (const issue of result.issues) {
    console.error(`${issue.code} ${issue.path}: ${issue.detail}`);
  }
  console.error(`\nK-8 curriculum pack validation FAILED: ${result.issues.length} issue(s).`);
  process.exit(1);
}

const pack = result.pack!;
console.log(
  `K-8 curriculum pack OK — ${pack.metadata.name} ${pack.metadata.version}; ${pack.skills.length} skill(s), ${pack.templates.length} template(s), ${pack.itemBankItems.length} item(s).`,
);
