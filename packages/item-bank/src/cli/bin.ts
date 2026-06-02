#!/usr/bin/env node
/**
 * Sprint 2.2 — `pnpm item-bank:import <dir>` CLI entry point.
 *
 * Usage:
 *
 *     pnpm item-bank:import fixtures/k-math-fall-2026
 *     pnpm item-bank:import path/to/items --dry-run
 *     pnpm item-bank:import path/to/items --subjects=math,reading
 *
 * The default adapter is the in-memory NULL adapter (validates + prints
 * a coverage report). Wire `--persist=prisma` (or other adapters) once
 * the assessment-svc model lands.
 */
import * as path from "node:path";
import { runImport, type PersistAdapter, NULL_PERSIST_ADAPTER } from "./import.js";

function parseArgs(argv: string[]): {
  inputDir: string | null;
  dryRun: boolean;
  subjects: string[] | null;
  persistKind: string;
  jsonReport: boolean;
} {
  let inputDir: string | null = null;
  let dryRun = false;
  let subjects: string[] | null = null;
  let persistKind = "null";
  let jsonReport = false;
  for (const a of argv) {
    if (a.startsWith("--subjects=")) {
      subjects = a.slice("--subjects=".length).split(",").filter(Boolean);
    } else if (a.startsWith("--persist=")) {
      persistKind = a.slice("--persist=".length);
    } else if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--json") {
      jsonReport = true;
    } else if (a.startsWith("-")) {
      throw new Error(`Unknown flag: ${a}`);
    } else if (!inputDir) {
      inputDir = a;
    } else {
      throw new Error(`Unexpected positional argument: ${a}`);
    }
  }
  return { inputDir, dryRun, subjects, persistKind, jsonReport };
}

function getPersist(kind: string, dryRun: boolean): PersistAdapter {
  if (dryRun || kind === "null") return NULL_PERSIST_ADAPTER;
  // The Prisma adapter lives in the assessment-svc once the items model
  // ships; importing it from here would create a cycle. We therefore
  // honour an env var that points at the JS file to load lazily.
  if (kind === "prisma") {
    const customPath = process.env.ITEM_BANK_PERSIST_MODULE;
    if (!customPath) {
      console.warn(
        "[item-bank-import] --persist=prisma requires ITEM_BANK_PERSIST_MODULE env; falling back to dry-run.",
      );
      return NULL_PERSIST_ADAPTER;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(customPath) as { default?: PersistAdapter } & PersistAdapter;
    return mod.default ?? mod;
  }
  throw new Error(`Unknown persist adapter: ${kind}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.inputDir) {
    console.error("Usage: item-bank:import <dir> [--dry-run] [--subjects=...] [--persist=...]");
    process.exit(2);
  }
  const inputDir = path.resolve(process.cwd(), args.inputDir);
  const persist = getPersist(args.persistKind, args.dryRun);
  const summary = await runImport({
    inputDir,
    persist,
    allowedSubjects: args.subjects ?? undefined,
  });

  if (args.jsonReport) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(
      `item-bank-import: ${summary.imported.length} items imported, ${summary.failed.length} failed.`,
    );

    console.log("Coverage by subject:");
    for (const [s, n] of Object.entries(summary.coverage.bySubject)) {
      console.log(`  ${s}: ${n} items`);
    }

    console.log("Coverage by grade band:");
    for (const [g, n] of Object.entries(summary.coverage.byGradeBand)) {
      console.log(`  ${g}: ${n} items`);
    }
    if (summary.failed.length > 0) {
      console.error("\nFailures:");
      for (const f of summary.failed) {
        console.error(`  ${f.file}${f.itemId ? `#${f.itemId}` : ""}: ${f.detail}`);
      }
    }
  }
  process.exit(summary.failed.length > 0 ? 1 : 0);
}

void main().catch((err) => {
  console.error("item-bank-import: fatal error", err);
  process.exit(1);
});
