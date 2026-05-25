#!/usr/bin/env node
/**
 * item-bank:validate — Sprint 3 gate.
 *
 * Loads the four production seed banks (math / ela / science / writing)
 * and asserts:
 *
 *   1. Every required subject has ≥20 items.
 *   2. Every item has a stable id and skillId, and at least one variant.
 *   3. Every variant passes validateItemVariant() (semver, weight,
 *      published-at, body, captions for media).
 *   4. Every surfaceType is in ROUTABLE_SURFACE_TYPES (the lesson-player
 *      SurfaceRouter can dispatch it).
 *   5. Item ids and variant ids are globally unique within the bank.
 *
 * Runs in the package's build output (`dist/`) — package.json wires this
 * after `tsc`. Exit non-zero on any failure so CI catches drift.
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const distEntry = join(packageRoot, "dist/index.js");

if (!existsSync(distEntry)) {
  console.error(
    `error: ${distEntry} not found. Run \`pnpm --filter @aivo/item-bank build\` first.`,
  );
  process.exit(2);
}

const mod = await import(pathToFileURL(distEntry).href);
const {
  getAllProductionItems,
  getProductionItemCounts,
  ROUTABLE_SURFACE_TYPES,
  validateItemVariant,
} = mod;

const REQUIRED_SUBJECTS = ["math", "ela", "science", "writing"];
const MIN_ITEMS_PER_SUBJECT = 20;

const errors = [];

// 1. Subject coverage.
const counts = getProductionItemCounts();
for (const subject of REQUIRED_SUBJECTS) {
  const n = counts[subject] ?? 0;
  if (n < MIN_ITEMS_PER_SUBJECT) {
    errors.push(`${subject}: ${n} items, threshold is ${MIN_ITEMS_PER_SUBJECT}`);
  }
}

// 2–5. Per-item / per-variant checks.
const allItems = getAllProductionItems();
const seenItemIds = new Set();
const seenVariantIds = new Set();

for (const item of allItems) {
  if (!item.id) errors.push("item missing id");
  if (!item.skillId) errors.push(`item ${item.id}: missing skillId`);
  if (!item.variants || item.variants.length === 0) {
    errors.push(`item ${item.id}: no variants`);
    continue;
  }
  if (seenItemIds.has(item.id)) errors.push(`duplicate item id: ${item.id}`);
  seenItemIds.add(item.id);

  for (const variant of item.variants) {
    if (seenVariantIds.has(variant.id)) {
      errors.push(`duplicate variant id: ${variant.id}`);
    }
    seenVariantIds.add(variant.id);

    const issues = validateItemVariant(variant);
    for (const issue of issues) {
      errors.push(`${variant.id}: ${issue.code} — ${issue.detail}`);
    }

    if (variant.surfaceType && !ROUTABLE_SURFACE_TYPES.has(variant.surfaceType)) {
      errors.push(
        `${variant.id}: surfaceType "${variant.surfaceType}" is not router-supported (allowed: ${[
          ...ROUTABLE_SURFACE_TYPES,
        ].join(", ")})`,
      );
    }
  }
}

// Report.
console.log("\nITEM BANK VALIDATION\n");
for (const subject of REQUIRED_SUBJECTS) {
  console.log(`  ${subject.padEnd(8)} items=${counts[subject] ?? 0}`);
}
console.log(`  TOTAL    items=${allItems.length}, variants=${seenVariantIds.size}`);

if (errors.length) {
  console.error("\nerrors:");
  for (const e of errors) console.error(`  error: ${e}`);
  console.error(`\nitem-bank:validate FAILED with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("\nitem-bank:validate OK.");
