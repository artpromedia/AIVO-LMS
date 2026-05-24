#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const fixturesRoot = join(repoRoot, "packages/item-bank/fixtures");
const itemsDir = join(fixturesRoot, "items");
const captionsDir = join(fixturesRoot, "captions");
const outputPath = join(repoRoot, "apps/web-v2/lib/learner/multimedia-item-bank.generated.json");

const SUBJECTS = ["math", "ela", "science"];
const SURFACES = new Set(["video", "audio"]);

function fail(message) {
  console.error(`item-bank multimedia import failed: ${message}`);
  process.exit(1);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function ensureCaptionAsset(item) {
  const caption = (item.assets ?? []).find((asset) => asset?.kind === "captions");
  if (!caption) {
    fail(`${item.id}: missing captions asset in assets[]`);
  }
  if (typeof caption.src !== "string" || !caption.src.endsWith(".vtt")) {
    fail(`${item.id}: captions asset src must be a .vtt path`);
  }
  const absCaptionPath = join(fixturesRoot, caption.src.replace(/^\.\//, ""));
  if (!existsSync(absCaptionPath)) {
    fail(`${item.id}: captions file not found at ${caption.src}`);
  }
  const vtt = readFileSync(absCaptionPath, "utf8");
  if (!vtt.startsWith("WEBVTT")) {
    fail(`${item.id}: captions file must start with WEBVTT`);
  }
  return { caption, vtt };
}

function ensureSurfaceAsset(item) {
  const media = (item.assets ?? []).find((asset) => asset?.kind === item.surfaceType);
  if (!media) {
    fail(`${item.id}: missing ${item.surfaceType} asset in assets[]`);
  }
}

const imported = { math: [], ela: [], science: [] };

for (const subject of SUBJECTS) {
  const path = join(itemsDir, `${subject}.multimedia.json`);
  if (!existsSync(path)) fail(`missing fixture file: ${path}`);
  const parsed = readJson(path);
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  if (items.length !== 10) {
    fail(`${subject}: expected 10 items, got ${items.length}`);
  }

  for (const item of items) {
    if (!SURFACES.has(item.surfaceType)) {
      fail(`${item.id}: surfaceType must be video|audio`);
    }
    ensureSurfaceAsset(item);
    const { caption, vtt } = ensureCaptionAsset(item);
    imported[subject].push({
      ...item,
      captionText: vtt,
      captionPath: caption.src,
    });
  }
}

const total = SUBJECTS.reduce((sum, subject) => sum + imported[subject].length, 0);
if (total !== 30) {
  fail(`expected 30 total items, got ${total}`);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), itemsBySubject: imported }, null, 2)}\n`,
);

console.log(`Imported ${total} multimedia fixture items into ${outputPath}`);
console.log(`Validated captions in ${captionsDir}`);
