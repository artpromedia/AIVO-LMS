// Quick screenshot rig for the redesign work. Drives the live dev
// server at localhost:5000 through three viewports and a small set of
// the surfaces I've touched this branch:
//   - / (demo home + Banner + role cards)
//   - /login (single-column-mobile, form-dominant-desktop)
//   - /parent/learners/new (the three-section add-learner form)
//   - /parent/home-v2 (auth'd parent home — exercises the redesigned
//     app-shell with sidebar drawer + Avatar)
// Output: screenshots/redesign/{route}-{viewport}.png

import { chromium } from "/home/user/AIVO-LMS/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:5000";
const OUT = "screenshots/redesign";
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },      // iPhone 14
  { name: "tablet", width: 820, height: 1180 },     // iPad portrait-ish
  { name: "desktop", width: 1440, height: 900 },    // common laptop
];

const ROUTES = [
  { path: "/", name: "home" },
  { path: "/login", name: "login" },
  { path: "/parent/learners/new", name: "add-learner", role: "parent" },
  { path: "/parent/home-v2", name: "parent-home-v2", role: "parent" },
];

const COOKIE_NAME = "aivo_mock_session";

const browser = await chromium.launch();
try {
  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
      });
      if (route.role) {
        await context.addCookies([
          {
            name: COOKIE_NAME,
            value: route.role,
            domain: "localhost",
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
          },
        ]);
      }
      const page = await context.newPage();
      const url = `${BASE}${route.path}`;
      const filename = `${OUT}/${route.name}-${vp.name}.png`;
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        // small extra settle for fonts / async surface paint
        await page.waitForTimeout(500);
        await page.screenshot({ path: filename, fullPage: true });
        console.log(`OK  ${route.name} @ ${vp.name}  →  ${filename}`);
      } catch (err) {
        console.log(
          `FAIL ${route.name} @ ${vp.name}  ${(err && err.message) || err}`,
        );
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}
