#!/usr/bin/env node
/**
 * Sprint 12.7 — migration linter.
 *
 * Static analysis of new SQL migration files. Rejects unsafe patterns
 * unless the file contains the explicit `-- aivo:allow-unsafe` comment
 * acknowledging the operator has reviewed the migration plan.
 *
 * Unsafe patterns:
 *   - DROP TABLE / DROP COLUMN / DROP DATABASE
 *   - ALTER COLUMN … TYPE …                 (potentially blocking rewrite)
 *   - ALTER COLUMN … SET NOT NULL           without DEFAULT in the same statement
 *   - TRUNCATE
 *   - REINDEX (synchronous form)
 *   - CREATE INDEX without CONCURRENTLY     (blocks writes on large tables)
 *
 * Exit codes:
 *   0  — all migration files pass
 *   1  — at least one finding (use `-- aivo:allow-unsafe` to override)
 *
 * Usage:
 *   pnpm db:migration-lint              — lint all migrations
 *   pnpm db:migration-lint path/to.sql  — lint a single file
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const MIGRATIONS_DIR = resolve(REPO_ROOT, "packages/db/migrations");

const ALLOW_UNSAFE = "-- aivo:allow-unsafe";

/** @type {{pattern: RegExp, message: string}[]} */
const UNSAFE_PATTERNS = [
  { pattern: /\bDROP\s+TABLE\b/i, message: "DROP TABLE" },
  { pattern: /\bDROP\s+COLUMN\b/i, message: "DROP COLUMN" },
  { pattern: /\bDROP\s+DATABASE\b/i, message: "DROP DATABASE" },
  { pattern: /\bDROP\s+INDEX\b(?!\s+CONCURRENTLY)/i, message: "DROP INDEX (non-CONCURRENTLY)" },
  {
    pattern: /\bALTER\s+COLUMN\s+\w+\s+TYPE\b/i,
    message: "ALTER COLUMN TYPE (potentially blocking)",
  },
  { pattern: /\bTRUNCATE\b/i, message: "TRUNCATE" },
  { pattern: /\bREINDEX\b(?!\s+CONCURRENTLY)/i, message: "REINDEX (non-CONCURRENTLY)" },
  {
    pattern:
      /\bCREATE\s+INDEX\b(?!\s+CONCURRENTLY)(?!\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+\w+\s*\([^)]*\)\s*WHERE\s)/i,
    message: "CREATE INDEX without CONCURRENTLY",
  },
];

/**
 * ALTER COLUMN SET NOT NULL without DEFAULT in the same statement.
 * Treated specially because the same regex would generate too many false
 * positives across multi-statement files.
 */
const NOT_NULL_NO_DEFAULT = /\bALTER\s+COLUMN\s+\w+\s+SET\s+NOT\s+NULL\b(?![^;]*\bDEFAULT\b)/i;

function lintFile(path) {
  const text = readFileSync(path, "utf8");
  if (text.includes(ALLOW_UNSAFE)) {
    return { findings: [], allowed: true };
  }
  const findings = [];
  for (const { pattern, message } of UNSAFE_PATTERNS) {
    if (pattern.test(text)) findings.push(message);
  }
  if (NOT_NULL_NO_DEFAULT.test(text)) {
    findings.push("SET NOT NULL without DEFAULT");
  }
  return { findings, allowed: false };
}

function collectFiles(argv) {
  if (argv.length > 0) return argv.map((p) => resolve(process.cwd(), p));
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => join(MIGRATIONS_DIR, f));
}

const files = collectFiles(process.argv.slice(2));
let failed = 0;
for (const file of files) {
  if (!statSync(file).isFile()) continue;
  const { findings, allowed } = lintFile(file);
  const rel = relative(REPO_ROOT, file);
  if (allowed) {
    console.log(`OK  (allow-unsafe) ${rel}`);
    continue;
  }
  if (findings.length === 0) {
    console.log(`OK             ${rel}`);
    continue;
  }
  failed += 1;
  console.error(`FAIL           ${rel}`);
  for (const f of findings) console.error(`               - ${f}`);
}

if (failed > 0) {
  console.error("");
  console.error(`${failed} migration file(s) contain unsafe patterns.`);
  console.error(
    `If the change is intentional, add the comment "${ALLOW_UNSAFE}" at the top of the file.`,
  );
  process.exit(1);
}
console.log("All migrations passed migration-lint.");
process.exit(0);
