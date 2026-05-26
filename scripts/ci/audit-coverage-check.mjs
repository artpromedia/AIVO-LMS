#!/usr/bin/env node
/**
 * Sprint 16 — every-route audit coverage gate.
 *
 * Walks every service's route definitions and, for each mutating HTTP
 * verb (POST / PUT / PATCH / DELETE), asserts the handler body contains
 * at least one audit emit call. Mutating routes without an audit emit
 * are reported and the script exits non-zero so CI blocks the PR.
 *
 * Supported route declaration styles:
 *   - Fastify TS/JS: `app.post(...)`, `app.put(...)`, `app.patch(...)`,
 *     `app.delete(...)` and the same with `app.route({ method: "POST" })`
 *     and `fastify.<verb>(...)` / `server.<verb>(...)` / `router.<verb>(...)`.
 *   - FastAPI Python: `@router.post(...)` / `@router.put(...)` /
 *     `@router.patch(...)` / `@router.delete(...)` and the same with
 *     `@app.<verb>(...)`.
 *
 * Audit emit patterns recognized:
 *   - `appendAudit(`           — packages/db audit chain
 *   - `audit.append(`          — alt naming
 *   - `auditService.emit(`     — service wrapper
 *   - `emitAudit(`             — node helper
 *   - `emitAuditEvent(`        — node helper
 *   - `emit_audit_event(`      — python helper
 *   - `record_audit(` / `recordAudit(`
 *   - `audit_log.write(` / `auditLog.write(`
 *
 * Allowlist:
 *   - A route handler is exempt when the line immediately preceding the
 *     route declaration contains `@audit-exempt:` followed by a reason.
 *     Example:
 *       // @audit-exempt: read-modify-read; covered by aggregate audit on parent op
 *       app.post("/api/foo/preview", { ... }, async () => { ... });
 *
 * Output:
 *   - Stdout: human-readable summary.
 *   - File: scripts/ci/results/audit-coverage-latest.json (always)
 *   - Exit code 0 if all mutating routes have audit emits or are exempt,
 *     otherwise 1. Pass --warn to never fail (useful during rollout).
 *
 * Usage:
 *   node scripts/ci/audit-coverage-check.mjs [--warn] [--out <path>]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

const args = process.argv.slice(2);
const WARN_ONLY = args.includes("--warn");
const outIdx = args.indexOf("--out");
const OUT_PATH =
  outIdx >= 0 && args[outIdx + 1]
    ? path.resolve(args[outIdx + 1])
    : path.join(repoRoot, "scripts", "ci", "results", "audit-coverage-latest.json");

const SERVICES_DIR = path.join(repoRoot, "services");
const MUTATING_VERBS = ["post", "put", "patch", "delete"];

// Patterns that indicate an audit emit somewhere inside the handler.
const AUDIT_PATTERNS = [
  /\bappendAudit\s*\(/,
  /\baudit\.append\s*\(/,
  /\bauditService\.emit\s*\(/,
  /\bemitAudit\s*\(/,
  /\bemitAuditEvent\s*\(/,
  /\bemit_audit_event\s*\(/,
  /\brecord_audit\s*\(/,
  /\brecordAudit\s*\(/,
  /\baudit_log\.write\s*\(/,
  /\bauditLog\.write\s*\(/,
];

// Directories we never walk into.
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".turbo",
  "__pycache__",
  ".pytest_cache",
  ".venv",
  "venv",
  "coverage",
  "tests",
  "__tests__",
  "test",
]);

/** Recursive walk yielding .ts/.js/.py files only. */
function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      if (/\.(ts|js|mjs|cjs|py)$/.test(entry.name)) {
        // Skip generated / test files.
        if (/\.test\.(ts|js)$|\.spec\.(ts|js)$|_test\.py$|test_.*\.py$/.test(entry.name))
          continue;
        yield full;
      }
    }
  }
}

/**
 * Given the full source text and the byte index of the route's opening
 * paren, locate the index of the matching closing paren by counting
 * brackets while ignoring string / template / comment contents.
 */
function findMatchingParen(src, openIdx) {
  let i = openIdx;
  let depth = 0;
  const len = src.length;
  let inStr = null; // ', ", `
  let inLineComment = false;
  let inBlockComment = false;
  while (i < len) {
    const ch = src[i];
    const next = src[i + 1];
    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (inStr) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === inStr) inStr = null;
      i++;
      continue;
    }
    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
      i++;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

/** Python equivalent — find end of decorator call ()s. */
function findMatchingParenPy(src, openIdx) {
  let i = openIdx;
  let depth = 0;
  const len = src.length;
  let inStr = null;
  let triple = false;
  while (i < len) {
    const ch = src[i];
    if (inStr) {
      if (triple) {
        if (src.slice(i, i + 3) === inStr) {
          inStr = null;
          triple = false;
          i += 3;
          continue;
        }
      } else if (ch === "\\") {
        i += 2;
        continue;
      } else if (ch === inStr) {
        inStr = null;
      }
      i++;
      continue;
    }
    if (src.slice(i, i + 3) === '"""' || src.slice(i, i + 3) === "'''") {
      inStr = src.slice(i, i + 3);
      triple = true;
      i += 3;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      i++;
      continue;
    }
    if (ch === "#") {
      // skip to EOL
      while (i < len && src[i] !== "\n") i++;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

/** Return the chars on the previous non-blank line (for exemption check). */
function previousLine(src, startIdx) {
  let i = startIdx - 1;
  while (i >= 0 && (src[i] === " " || src[i] === "\t")) i--;
  // i should now be on '\n' or earlier
  if (src[i] === "\n") i--;
  let end = i + 1;
  while (i >= 0 && src[i] !== "\n") i--;
  return src.slice(i + 1, end);
}

function isExempt(src, declStart) {
  const prev = previousLine(src, declStart).trim();
  return /@audit-exempt\s*:/i.test(prev);
}

function containsAudit(handlerSrc) {
  return AUDIT_PATTERNS.some((p) => p.test(handlerSrc));
}

/**
 * Scan a Fastify-style file. We look for `<name>.<verb>(` where name is
 * one of the conventional Fastify instance names. For `app.route({...})`
 * we extract the `method` literal.
 */
function scanFastify(file, src) {
  const routes = [];
  const verbAlternation = MUTATING_VERBS.join("|");
  const instance = "(?:app|fastify|server|router|instance)";
  const verbRe = new RegExp(`\\b${instance}\\.(${verbAlternation})\\s*\\(`, "gi");
  let m;
  while ((m = verbRe.exec(src))) {
    const verb = m[1].toUpperCase();
    const openParenIdx = src.indexOf("(", m.index);
    if (openParenIdx === -1) continue;
    const closeIdx = findMatchingParen(src, openParenIdx);
    if (closeIdx === -1) continue;
    const handlerSrc = src.slice(openParenIdx, closeIdx + 1);
    // Try to grab the path literal (first string arg)
    const pathMatch = handlerSrc.match(/["'`]([^"'`]+)["'`]/);
    const route = pathMatch ? pathMatch[1] : "<dynamic>";
    routes.push({
      file: path.relative(repoRoot, file),
      verb,
      route,
      hasAudit: containsAudit(handlerSrc),
      exempt: isExempt(src, m.index),
    });
  }
  // app.route({ method: "POST", url: "...", handler: ... })
  const routeBlockRe = /\b(?:app|fastify|server)\.route\s*\(\s*\{/g;
  while ((m = routeBlockRe.exec(src))) {
    const openParenIdx = src.indexOf("(", m.index);
    if (openParenIdx === -1) continue;
    const closeIdx = findMatchingParen(src, openParenIdx);
    if (closeIdx === -1) continue;
    const block = src.slice(openParenIdx, closeIdx + 1);
    const methodMatch = block.match(/method\s*:\s*["'`]([A-Z]+)["'`]/i);
    if (!methodMatch) continue;
    const verb = methodMatch[1].toUpperCase();
    if (!MUTATING_VERBS.includes(verb.toLowerCase())) continue;
    const urlMatch = block.match(/url\s*:\s*["'`]([^"'`]+)["'`]/);
    routes.push({
      file: path.relative(repoRoot, file),
      verb,
      route: urlMatch ? urlMatch[1] : "<dynamic>",
      hasAudit: containsAudit(block),
      exempt: isExempt(src, m.index),
    });
  }
  return routes;
}

function scanFastAPI(file, src) {
  const routes = [];
  const verbAlternation = MUTATING_VERBS.join("|");
  const re = new RegExp(`@(?:router|app|api|r)\\.(${verbAlternation})\\s*\\(`, "gi");
  let m;
  while ((m = re.exec(src))) {
    const verb = m[1].toUpperCase();
    const openParenIdx = src.indexOf("(", m.index);
    if (openParenIdx === -1) continue;
    const closeIdx = findMatchingParenPy(src, openParenIdx);
    if (closeIdx === -1) continue;
    // Capture the decorated function body: from the decorator down to
    // the next top-level decorator or async def at column 0, or EOF.
    const afterDecorator = src.slice(closeIdx + 1);
    // Find the end of this function (next "@router/@app." at col 0 or
    // next "def "/"async def" preceded by newline at col 0 after we've
    // already consumed the current function's def).
    // Heuristic: search forward for the next "\n@" or "\nasync def " or
    // "\ndef " that comes AFTER the function's own def signature.
    const defMatch = afterDecorator.match(/\n\s*(?:async\s+)?def\s+\w+\s*\(/);
    if (!defMatch) continue;
    const bodyStart = (defMatch.index ?? 0) + defMatch[0].length;
    const rest = afterDecorator.slice(bodyStart);
    const nextTop = rest.search(/\n@\w|\nclass\s|\n(?:async\s+)?def\s/);
    const bodyEnd = nextTop === -1 ? rest.length : nextTop;
    const handlerSrc = rest.slice(0, bodyEnd);
    const pathMatch = src.slice(openParenIdx, closeIdx + 1).match(/["']([^"']+)["']/);
    routes.push({
      file: path.relative(repoRoot, file),
      verb,
      route: pathMatch ? pathMatch[1] : "<dynamic>",
      hasAudit: containsAudit(handlerSrc),
      exempt: isExempt(src, m.index),
    });
  }
  return routes;
}

function scanFile(file) {
  let src;
  try {
    src = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  if (file.endsWith(".py")) return scanFastAPI(file, src);
  return scanFastify(file, src);
}

function main() {
  const allRoutes = [];
  for (const file of walk(SERVICES_DIR)) {
    allRoutes.push(...scanFile(file));
  }

  const mutating = allRoutes;
  const missing = mutating.filter((r) => !r.hasAudit && !r.exempt);
  const exempt = mutating.filter((r) => r.exempt);
  const covered = mutating.filter((r) => r.hasAudit);

  const byService = {};
  for (const r of missing) {
    const svc = r.file.split(path.sep)[1] || "unknown";
    byService[svc] = (byService[svc] || 0) + 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      mutating: mutating.length,
      covered: covered.length,
      exempt: exempt.length,
      missing: missing.length,
    },
    missingByService: byService,
    missing: missing
      .slice()
      .sort((a, b) => a.file.localeCompare(b.file) || a.route.localeCompare(b.route))
      .map((r) => ({ file: r.file, verb: r.verb, route: r.route })),
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));

  process.stdout.write("\n══ audit-coverage-check ═══════════════════════════════════\n");
  process.stdout.write(`Scanned mutating routes : ${mutating.length}\n`);
  process.stdout.write(`Covered                 : ${covered.length}\n`);
  process.stdout.write(`Exempt (allowlisted)    : ${exempt.length}\n`);
  process.stdout.write(`Missing audit emit      : ${missing.length}\n`);
  process.stdout.write(`Report written to       : ${path.relative(repoRoot, OUT_PATH)}\n`);

  if (missing.length > 0) {
    process.stdout.write("\nTop offending services:\n");
    const sorted = Object.entries(byService).sort((a, b) => b[1] - a[1]);
    for (const [svc, count] of sorted.slice(0, 10)) {
      process.stdout.write(`  ${svc.padEnd(28)} ${count}\n`);
    }
    process.stdout.write(
      "\nFirst 20 missing routes (full list in report file):\n",
    );
    for (const r of missing.slice(0, 20)) {
      process.stdout.write(`  ${r.verb.padEnd(6)} ${r.route.padEnd(60)} ${r.file}\n`);
    }
    process.stdout.write(
      "\nFix: add an audit emit (appendAudit / emit_audit_event) inside each\n" +
        "handler, or annotate with `// @audit-exempt: <reason>` on the line\n" +
        "immediately above the route declaration.\n",
    );
    if (WARN_ONLY) {
      process.stdout.write("--warn passed; exiting 0 anyway.\n");
      process.exit(0);
    }
    process.exit(1);
  }

  process.stdout.write("\nAll mutating routes emit an audit event. PASS.\n");
}

main();
