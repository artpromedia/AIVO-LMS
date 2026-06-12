/**
 * Sprint 15 — the theming visual matrix.
 *
 * Part A (tutor identity): the lesson welcome beat for two contrast
 * tutors (nova: math violet · sage: reading green) under each global
 * sensory mode — 6 snapshots — plus a material pixel-diff assertion
 * between nova and sage in standard mode, so silent de-theming can never
 * pass CI. Axe runs on the themed lesson page in every mode (@a11y).
 *
 * Part B (role × sensory): the five role homes under the three global
 * sensory modes — 15 snapshots — so palette/motion regressions in ANY
 * mode are caught by pixels, not by users.
 *
 * Every capture goes through the anti-blank variance guard from the
 * visual-a11y suite: a blank baseline cannot be recorded or compared.
 */
import { test, expect, type Page } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";
import { PNG } from "pngjs";

const BASE = process.env.WEB_V2_BASE_URL ?? "http://127.0.0.1:5000";
const SENSORY_MODES = ["standard", "calm", "high-contrast"] as const;
type SensoryMode = (typeof SENSORY_MODES)[number];

const ROLE_HOMES = [
  { role: "parent", path: "/parent/home" },
  { role: "learner", path: "/learner/home" },
  { role: "teacher", path: "/teacher/home" },
  { role: "caregiver", path: "/caregiver/home" },
  { role: "therapist", path: "/therapist/home" },
] as const;

function cookiesFor(role: string, mode: SensoryMode) {
  return [
    { name: "aivo_mock_session", value: role, url: BASE },
    { name: "aivo.sensoryMode", value: mode, url: BASE },
  ];
}

/** Anti-blank guard (same variance test as visual-a11y.playwright.ts). */
function assertNotBlank(buffer: Buffer, name: string): void {
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
    throw new Error(
      `screenshot "${name}" is near-uniform (stddev=${stddev.toFixed(2)}) — ` +
        "the page rendered blank; refusing to record/compare a blank baseline",
    );
  }
}

async function shoot(page: Page, name: string): Promise<Buffer> {
  await page.waitForSelector("main");
  const buffer = await page.screenshot({ fullPage: true, animations: "disabled" });
  assertNotBlank(buffer, name);
  await expect(page).toHaveScreenshot(name, { fullPage: true, animations: "disabled" });
  return buffer;
}

/** Fraction of sampled pixels whose RGB differs materially between shots. */
function pixelDiffRatio(a: Buffer, b: Buffer): number {
  const pa = PNG.sync.read(a);
  const pb = PNG.sync.read(b);
  const len = Math.min(pa.data.length, pb.data.length);
  let sampled = 0;
  let differing = 0;
  for (let i = 0; i + 2 < len; i += 40) {
    sampled += 1;
    const d =
      Math.abs(pa.data[i] - pb.data[i]) +
      Math.abs(pa.data[i + 1] - pb.data[i + 1]) +
      Math.abs(pa.data[i + 2] - pb.data[i + 2]);
    if (d > 24) differing += 1;
  }
  return differing / Math.max(sampled, 1);
}

test.describe("theming matrix — Part A: tutor identity @a11y", () => {
  const lessonUrl = (tutor: "nova" | "sage") =>
    `/learner/lesson-player-fixture?surfaceType=choice_grid&tutor=${tutor}`;

  const captured = new Map<string, Buffer>();

  for (const mode of SENSORY_MODES) {
    for (const tutor of ["nova", "sage"] as const) {
      test(`${tutor} lesson welcome — ${mode}`, async ({ context, page }) => {
        await context.addCookies(cookiesFor("learner", mode));
        await page.goto(lessonUrl(tutor), { waitUntil: "domcontentloaded" });
        await page.getByTestId("welcome-beat").waitFor({ timeout: 30_000 });
        await page.getByTestId("tutor-welcome-line").waitFor();
        // The identity attribute is present in EVERY mode (non-visual).
        await expect(page.locator(`[data-tutor="${tutor}"]`)).toBeVisible();

        const buffer = await shoot(page, `lesson-${tutor}-${mode}.png`);
        captured.set(`${tutor}-${mode}`, buffer);

        // Themed pages introduce no axe violations, in any mode.
        await injectAxe(page);
        await checkA11y(page, undefined, {
          detailedReport: true,
          axeOptions: { resultTypes: ["violations"] },
          includedImpacts: ["critical", "serious"],
        });
      });
    }
  }

  test("nova and sage are materially distinct in standard mode", async ({ context, page }) => {
    // Re-capture raw (non-snapshot) buffers so this test stands alone —
    // Playwright runs files in isolated workers and order isn't guaranteed.
    await context.addCookies(cookiesFor("learner", "standard"));
    await page.goto(lessonUrl("nova"), { waitUntil: "domcontentloaded" });
    await page.getByTestId("tutor-welcome-line").waitFor({ timeout: 30_000 });
    await page.waitForSelector("main");
    const nova = await page.screenshot({ fullPage: true, animations: "disabled" });
    assertNotBlank(nova, "nova-diff-probe");

    await page.goto(lessonUrl("sage"), { waitUntil: "domcontentloaded" });
    await page.getByTestId("tutor-welcome-line").waitFor({ timeout: 30_000 });
    const sage = await page.screenshot({ fullPage: true, animations: "disabled" });
    assertNotBlank(sage, "sage-diff-probe");

    const ratio = pixelDiffRatio(nova, sage);
    // Accent vars + signature line + portrait must move a real fraction
    // of pixels. A de-themed player (both neutral) measures ~0 here.
    expect(
      ratio,
      `nova vs sage pixel-diff ratio ${ratio.toFixed(4)} — silent de-theming?`,
    ).toBeGreaterThan(0.01);
  });
});

test.describe("theming matrix — Part B: role homes × sensory modes", () => {
  for (const { role, path } of ROLE_HOMES) {
    for (const mode of SENSORY_MODES) {
      test(`${role} home — ${mode}`, async ({ context, page }) => {
        await context.addCookies(cookiesFor(role, mode));
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await shoot(page, `home-${role}-${mode}.png`);
      });
    }
  }
});
