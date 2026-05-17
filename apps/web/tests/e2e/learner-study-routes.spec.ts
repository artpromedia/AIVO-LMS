import { test, expect, type Page } from "@playwright/test";
import {
  BANNED_PHRASES,
  LEARNER_STUDY_ROUTES,
  QUEST_WORLD_KEYS,
} from "./learner-study-routes.manifest";

/**
 * Regression crawler — fails CI if any learner study route renders
 * stub/placeholder/coming-soon/mock content. See the manifest for the
 * route list and banned phrases.
 *
 * The crawler mocks every backend endpoint the learner surfaces touch,
 * so it can run without bringing up the full stack. API contract +
 * seed validation live in services/engagement-svc/tests/ and run as
 * unit tests on every PR.
 */

const LEARNER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "learner@aivo.test",
  name: "Test Learner",
  role: "LEARNER",
  tenantId: "22222222-2222-4222-8222-222222222222",
};

const WORLDS = QUEST_WORLD_KEYS.map((key, i) => ({
  key,
  name: WORLD_DISPLAY_NAMES[key],
  tutorKey: WORLD_TUTOR_KEYS[key],
  subject: WORLD_SUBJECTS[key],
  description: `${WORLD_DISPLAY_NAMES[key]} description`,
  chapters: 5,
  _i: i,
}));

const QUEST_CHAPTERS = WORLDS.flatMap((w) =>
  Array.from({ length: 5 }, (_, idx) => ({
    id: `${w.key}-ch${idx + 1}`,
    worldKey: w.key,
    chapterNumber: idx + 1,
    title: `${w.name} chapter ${idx + 1}`,
    description: `Sample chapter ${idx + 1}`,
    narrativeIntro: `Welcome to chapter ${idx + 1}.`,
    narrativeOutro: `Chapter ${idx + 1} complete.`,
    subject: w.subject,
    xpReward: 50,
    coinReward: 10,
    bossAssessment: {
      passingScore: 70,
      questions: [
        {
          id: `${w.key}-ch${idx + 1}-q1`,
          prompt: "Sample?",
          choices: ["A", "B"],
          answerIndex: 0,
          explanation: "A is correct.",
          difficulty: "easy",
          skillTag: "demo.placeholder",
        },
      ],
    },
  })),
);

async function mockBackend(page: Page) {
  await page.route("**/api/auth/refresh", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accessToken: "learner-token", mustChangePassword: false }),
    }),
  );
  await page.route("**/api/users/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(LEARNER),
    }),
  );
  await page.route("**/api/users/learners", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: LEARNER.id, userId: LEARNER.id, gradeLevel: "3" },
      ]),
    }),
  );

  await page.route("**/api/engagement/quests/worlds", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(WORLDS.map(({ _i, ...w }) => w)),
    }),
  );
  await page.route("**/api/engagement/quests/worlds/*", (route) => {
    const slug = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/").pop() ?? "",
    );
    const world = WORLDS.find((w) => w.key === slug || w.tutorKey === slug);
    if (!world) {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "quest_world_not_found", slug }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(world),
    });
  });
  await page.route("**/api/engagement/quests/progress/*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  for (const w of WORLDS) {
    await page.route(`**/api/engagement/quests/${w.key}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          world: w,
          quests: QUEST_CHAPTERS.filter((q) => q.worldKey === w.key),
        }),
      }),
    );
  }

  // Tutor entitlement endpoints. Use the tenant-scoped billing one the
  // web client actually hits.
  await page.route("**/api/billing/entitlements/*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        plan: "family",
        status: "active",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        paymentStatus: "paid",
        includedTutorSkus: [
          "ADDON_TUTOR_ELA",
          "ADDON_TUTOR_MATH",
          "ADDON_TUTOR_SCIENCE",
          "ADDON_TUTOR_HISTORY",
        ],
        purchasedTutorSkus: ["ADDON_TUTOR_CODING"],
        effectiveTutorSkus: [
          "ADDON_TUTOR_ELA",
          "ADDON_TUTOR_MATH",
          "ADDON_TUTOR_SCIENCE",
          "ADDON_TUTOR_HISTORY",
          "ADDON_TUTOR_CODING",
        ],
      }),
    }),
  );
}

async function findBannedPhrase(page: Page): Promise<string | null> {
  // Grab the rendered body text in lowercase so phrase matching is
  // case-insensitive without leaking diagnostics into raw HTML.
  const body = await page.locator("body").innerText();
  const haystack = body.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (haystack.includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}

test.describe("learner study routes regression crawler", () => {
  for (const route of LEARNER_STUDY_ROUTES) {
    test(`${route.name} renders without stub content`, async ({ page }) => {
      await mockBackend(page);
      const response = await page.goto(route.path, { waitUntil: "networkidle" });
      expect(response, `no response for ${route.path}`).not.toBeNull();
      expect(
        response!.status(),
        `unexpected status for ${route.path}`,
      ).toBeLessThan(500);

      const banned = await findBannedPhrase(page);
      expect(
        banned,
        `Route ${route.path} rendered a banned phrase: ${banned ?? ""}`,
      ).toBeNull();

      for (const required of route.mustContain ?? []) {
        await expect(page.getByText(required)).toBeVisible();
      }
    });
  }
});

const WORLD_DISPLAY_NAMES: Record<string, string> = {
  nova_number_galaxy: "Nova's Number Galaxy",
  sage_story_kingdom: "Sage's Story Kingdom",
  spark_science_lab: "Spark's Science Lab",
  chrono_time_tower: "Chrono's Time Tower",
  pixel_code_forge: "Pixel's Code Forge",
};
const WORLD_TUTOR_KEYS: Record<string, string> = {
  nova_number_galaxy: "nova",
  sage_story_kingdom: "sage",
  spark_science_lab: "spark",
  chrono_time_tower: "chrono",
  pixel_code_forge: "pixel",
};
const WORLD_SUBJECTS: Record<string, string> = {
  nova_number_galaxy: "Mathematics",
  sage_story_kingdom: "English Language Arts",
  spark_science_lab: "Science",
  chrono_time_tower: "History",
  pixel_code_forge: "Coding & Computer Science",
};
