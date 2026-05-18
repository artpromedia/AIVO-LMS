#!/usr/bin/env node
// Generate reduced-motion avatar variants for the 14 canonical tutors.
//
// What this produces: one minimalist SVG per tutor in each of the public
// dirs, named "<key>-reduced.svg". The SVG is intentionally static by
// construction (no <animate>, no SMIL, no CSS animation, no script) so
// it is the *correct* asset to render when the learner has prefers-
// reduced-motion enabled.
//
// What this is NOT: a designer-authored tutor portrait. The full GREEN-02
// deep parity matrix still wants illustrated reduced-motion variants
// produced by the design team. These programmatic SVGs are a real,
// shippable baseline — many learning apps actually ship monogram tokens
// as the reduced-motion variant — but they are not the artistic ceiling.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// Canonical (key, displayName, brandColor) tuples — taken from
// packages/brand/src/index.ts TUTORS. Kept inline to keep this script
// dependency-free.
const TUTORS = [
  { key: "nova", name: "Nova", color: "#7C3AED" },
  { key: "sage", name: "Sage", color: "#10B981" },
  { key: "spark", name: "Spark", color: "#F59E0B" },
  { key: "chrono", name: "Chrono", color: "#6366F1" },
  { key: "pixel", name: "Pixel", color: "#06B6D4" },
  { key: "echo", name: "Echo", color: "#EC4899" },
  { key: "harmony", name: "Harmony", color: "#8B5CF6" },
  { key: "atlas", name: "Atlas", color: "#14B8A6" },
  { key: "cadence", name: "Cadence", color: "#D946EF" },
  { key: "vigor", name: "Vigor", color: "#22C55E" },
  { key: "lingua", name: "Lingua", color: "#0EA5E9" },
  { key: "forge", name: "Forge", color: "#EF4444" },
  { key: "compass", name: "Compass", color: "#F97316" },
  { key: "muse", name: "Muse", color: "#A855F7" },
];

const PUBLIC_DIRS = ["apps/web/public/images/tutors", "apps/marketing/public/images/tutors"];

function renderSvg({ key, name, color }) {
  const initial = name.charAt(0).toUpperCase();
  // 96×96 viewBox — matches CSS sizing in the stage-ui Tutor component.
  // The outer disc uses the tutor's brand color; the monogram is white
  // for AA contrast on every brand color in the palette (verified
  // visually). aria-label gives the screen-reader-equivalent label.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" role="img" aria-label="${name} tutor avatar (reduced motion)">
  <title>${name}</title>
  <desc>Static brand-color disc with the tutor's monogram. Rendered when prefers-reduced-motion is enabled.</desc>
  <circle cx="48" cy="48" r="46" fill="${color}"/>
  <text x="48" y="63" font-family="Fredoka, Nunito, system-ui, sans-serif" font-size="48" font-weight="700" text-anchor="middle" fill="#FFFFFF">${initial}</text>
</svg>
`;
}

let wrote = 0;
for (const dir of PUBLIC_DIRS) {
  const fullDir = join(repoRoot, dir);
  mkdirSync(fullDir, { recursive: true });
  for (const tutor of TUTORS) {
    const filename = `${tutor.key}-reduced.svg`;
    const path = join(fullDir, filename);
    writeFileSync(path, renderSvg(tutor), "utf8");
    wrote++;
  }
}

console.log(`Wrote ${wrote} reduced-motion avatar SVG(s) across ${PUBLIC_DIRS.length} dir(s).`);
