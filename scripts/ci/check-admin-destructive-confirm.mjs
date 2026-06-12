#!/usr/bin/env node
/**
 * check-admin-destructive-confirm (Sprint 10) — destructive admin verbs
 * never ship one-click.
 *
 * Scans apps/web-admin/app for files whose server actions or handlers match
 * /revoke|delete|disable|rotate/i; each such file must import
 * ConfirmDangerDialog (the confirmation gate) or be allowlisted with a
 * reason. The allowlist starts empty and should stay that way.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const allowlist = JSON.parse(
  readFileSync(join(repoRoot, "scripts", "ci", "admin-destructive-allowlist.json"), "utf8"),
);

let files = [];
try {
  files = execFileSync(
    "grep",
    [
      "-rlEi",
      "--include=*.tsx",
      "(async function|const) [A-Za-z]*(revoke|delete|disable|rotate)[A-Za-z]*",
      join(repoRoot, "apps/web-admin/app"),
    ],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean);
} catch {
  files = [];
}

const offenders = [];
for (const file of files) {
  const rel = file.replace(repoRoot + "/", "");
  if (allowlist.files?.[rel]) continue;
  const src = readFileSync(file, "utf8");
  if (!src.includes("ConfirmDangerDialog")) offenders.push(rel);
}

if (offenders.length) {
  console.error(
    "check-admin-destructive-confirm FAILED — destructive actions without a confirmation gate:\n" +
      offenders.map((f) => "  - " + f).join("\n") +
      "\nWrap the trigger in ConfirmDangerDialog (packages/admin-ui) or allowlist with a reason.",
  );
  process.exit(1);
}
console.log(
  `check-admin-destructive-confirm OK (${files.length} destructive-action file(s), all gated).`,
);
