#!/usr/bin/env node
/**
 * Regenerates the design-language "after" snapshots in
 * screenshots/design-language/ from a running web-v2 instance.
 *
 * Usage: BASE_URL=http://127.0.0.1:5000 node scripts/capture-design-language.mjs
 *
 * The server must be started the same way the visual e2e suite expects
 * (AUTH_MODE=mock so the learner cookie below mints the demo learner).
 * Captures are refused if they come back near-uniform — a blank page means
 * the app was not actually serving, and committing it would recreate the
 * blank-screenshot bug this script exists to fix.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// playwright + pngjs are devDependencies of @aivo/web-v2, not the repo root —
// resolve them from that workspace so this script runs from anywhere.
const webV2Require = createRequire(resolve(repoRoot, "apps/web-v2/package.json"));
const { chromium } = webV2Require("@playwright/test");
const { PNG } = webV2Require("pngjs");
const outDir = resolve(repoRoot, "screenshots/design-language");
const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:5000";

const PAGES = [
  { route: "/", file: "landing-after.png" },
  { route: "/login", file: "login-after.png" },
  { route: "/learner/home", file: "learner-home-after.png" },
  { route: "/learner/rewards", file: "rewards-after.png" },
];

function assertNotBlank(buffer, name) {
  const png = PNG.sync.read(buffer);
  let count = 0;
  let mean = 0;
  let m2 = 0;
  for (let i = 0; i + 2 < png.data.length; i += 64) {
    const value = (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3;
    count += 1;
    const delta = value - mean;
    mean += delta / count;
    m2 += delta * (value - mean);
  }
  const stddev = Math.sqrt(m2 / Math.max(count, 1));
  if (stddev < 5) {
    throw new Error(`${name}: capture is near-uniform (stddev=${stddev.toFixed(2)}) — refusing`);
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await context.addCookies([
  {
    name: "aivo_mock_session",
    value: "learner",
    url: baseUrl,
  },
]);
const page = await context.newPage();
mkdirSync(outDir, { recursive: true });

for (const { route, file } of PAGES) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  await page.waitForSelector("main");
  const shot = await page.screenshot({ fullPage: true });
  assertNotBlank(shot, file);
  writeFileSync(resolve(outDir, file), shot);
  console.log(`captured ${file} (${shot.length} bytes)`);
}

await browser.close();
console.log(`design-language captures written to ${outDir}`);
