#!/usr/bin/env node
/**
 * check-file-length (Sprint 12) — no more god files.
 *
 * Fails when any .ts/.tsx under the scanned roots exceeds MAX_LINES,
 * except paths recorded in file-length-allowlist.json (the frozen
 * baseline, each with the line count at freeze time). The allowlist only
 * shrinks: decomposing an entry removes it; new files must arrive small.
 * An allowlisted file that grows past its recorded count also fails —
 * frozen means frozen.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MAX_LINES = 600;
const ROOTS = ["apps/web-v2/app", "apps/web-v2/components", "apps/mobile/src"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", ".expo"]);

const allowlist = JSON.parse(
  readFileSync(join(repoRoot, "scripts", "ci", "file-length-allowlist.json"), "utf8"),
);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) yield* walk(abs);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".d.ts")) {
      yield abs;
    }
  }
}

const offenders = [];
const grown = [];
let scanned = 0;
for (const root of ROOTS) {
  for (const file of walk(join(repoRoot, root))) {
    scanned += 1;
    const lines = readFileSync(file, "utf8").split("\n").length;
    if (lines <= MAX_LINES) continue;
    const rel = relative(repoRoot, file);
    const frozen = allowlist.files?.[rel];
    if (frozen === undefined) {
      offenders.push(`${rel} (${lines} lines)`);
    } else if (lines > frozen.lines) {
      grown.push(`${rel} (${lines} lines, frozen at ${frozen.lines})`);
    }
  }
}

if (offenders.length || grown.length) {
  if (offenders.length) {
    console.error(
      `check-file-length FAILED — files over ${MAX_LINES} lines:\n` +
        offenders.map((f) => "  - " + f).join("\n") +
        "\nDecompose into modules (see apps/web-v2/.../lesson-runs/[lessonRunId]/player/ " +
        "for the pattern). Do not add to the allowlist — it only shrinks.",
    );
  }
  if (grown.length) {
    console.error(
      "check-file-length FAILED — allowlisted baseline files grew:\n" +
        grown.map((f) => "  - " + f).join("\n") +
        "\nFrozen means frozen: shrink the file back or decompose it.",
    );
  }
  process.exit(1);
}
console.log(
  `check-file-length OK (${scanned} files scanned, ` +
    `${Object.keys(allowlist.files ?? {}).length} frozen baseline file(s), max ${MAX_LINES} lines).`,
);
