import { test, expect } from "@playwright/test";

/**
 * E2E for the Quest Play surface.
 *
 * Verifies the full study path that used to dead-end at a non-existent
 * route: list → world detail → Start → /play/:questId → answer questions
 * → complete → XP/coin celebration → back to world detail.
 *
 * All engagement-svc traffic is mocked here so the test runs without a
 * backend. Real content + DB seed are covered by the engagement-svc unit
 * tests.
 */

const WORLD = {
  key: "nova_number_galaxy",
  name: "Nova's Number Galaxy",
  tutorKey: "nova",
  subject: "Mathematics",
  description: "Explore the cosmos of numbers with Nova!",
  chapters: 5,
};

const QUEST = {
  id: "11111111-1111-4111-8111-111111111111",
  worldKey: WORLD.key,
  chapterNumber: 1,
  title: "Counting Stars",
  description: "Learn to count the stars in Nova's galaxy",
  narrativeIntro: "Welcome, explorer! Count the stars in the galaxy.",
  narrativeOutro: "Brilliant counting! Every star is accounted for.",
  subject: "Mathematics",
  xpReward: 50,
  coinReward: 10,
  bossAssessment: {
    passingScore: 70,
    questions: [
      {
        id: "n1q1",
        prompt: "How many stars: star star star star?",
        choices: ["3", "4", "5", "6"],
        answerIndex: 1,
        explanation: "Four stars.",
        difficulty: "easy",
        skillTag: "math.counting",
      },
      {
        id: "n1q2",
        prompt: "What comes after 7?",
        choices: ["6", "7", "8", "9"],
        answerIndex: 2,
        explanation: "Eight.",
        difficulty: "easy",
        skillTag: "math.counting",
      },
      {
        id: "n1q3",
        prompt: "Which group has more? 5 stars or 3 stars?",
        choices: ["First", "Second", "Same", "Cannot tell"],
        answerIndex: 0,
        explanation: "Five is more.",
        difficulty: "easy",
        skillTag: "math.compare",
      },
    ],
  },
};

const LEARNER = {
  id: "11111111-2222-4111-8111-111111111111",
  email: "learner@aivo.test",
  name: "Test Learner",
  role: "LEARNER",
  tenantId: "t1",
};

test.describe("learner quest play surface", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/auth/refresh", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accessToken: "learner-token", mustChangePassword: false }),
      }),
    );
    await page.route("**/api/users/me", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(LEARNER) }),
    );
    await page.route("**/api/users/learners", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: LEARNER.id, userId: LEARNER.id, gradeLevel: "3" }]),
      }),
    );

    await page.route("**/api/engagement/quests/worlds", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([WORLD]) }),
    );
    await page.route("**/api/engagement/quests/worlds/*", (route) => {
      const slug = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop() ?? "");
      if (slug === WORLD.key || slug === WORLD.tutorKey) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(WORLD),
        });
      }
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "quest_world_not_found", slug }),
      });
    });
    await page.route(`**/api/engagement/quests/${WORLD.key}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ world: WORLD, quests: [QUEST] }),
      }),
    );
    await page.route(`**/api/engagement/quests/chapter/${QUEST.id}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ quest: QUEST, world: WORLD }),
      }),
    );
    await page.route("**/api/engagement/quests/progress/*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
    );
    await page.route("**/api/engagement/quests/start", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          progress: {
            id: "p1",
            learnerId: LEARNER.id,
            questId: QUEST.id,
            status: "IN_PROGRESS",
            score: 0,
            completedAt: null,
          },
          quest: QUEST,
        }),
      }),
    );
    await page.route("**/api/engagement/quests/complete", async (route) => {
      const req = route.request();
      const body = req.postDataJSON() as { score: number };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          completed: true,
          score: body.score,
          xpAwarded: QUEST.xpReward,
          coinAwarded: QUEST.coinReward,
          alreadyCompleted: false,
        }),
      });
    });
  });

  test("Start opens the play surface and completion awards XP + coins", async ({ page }) => {
    await page.goto(`/dashboard/learner/quests/${WORLD.key}`);
    await expect(page.getByRole("heading", { name: WORLD.name })).toBeVisible();

    await page.getByRole("button", { name: /start quest/i }).click();
    await expect(page).toHaveURL(new RegExp(`/play/${QUEST.id}$`));
    await expect(page.getByRole("heading", { name: QUEST.title })).toBeVisible();
    await expect(page.getByText(QUEST.narrativeIntro)).toBeVisible();

    await page.getByTestId("begin-quest").click();

    for (const q of QUEST.bossAssessment.questions) {
      await page.getByTestId(`choice-${q.id}-${q.answerIndex}`).click();
    }

    await expect(page.getByTestId("running-score")).toHaveText("100%");
    await page.getByTestId("finish-quest").click();

    const summary = page.getByTestId("completion-summary");
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("100%");
    await expect(summary).toContainText(`+${QUEST.xpReward}`);
    await expect(summary).toContainText(`+${QUEST.coinReward}`);
    await expect(summary).toContainText(QUEST.narrativeOutro);
  });

  test("answering a question wrong reveals the explanation and lowers the score", async ({ page }) => {
    await page.goto(`/dashboard/learner/quests/${WORLD.key}/play/${QUEST.id}`);
    await page.getByTestId("begin-quest").click();

    const q1 = QUEST.bossAssessment.questions[0];
    const wrongIdx = q1.answerIndex === 0 ? 1 : 0;
    await page.getByTestId(`choice-${q1.id}-${wrongIdx}`).click();
    await expect(page.getByText(q1.explanation)).toBeVisible();

    for (const q of QUEST.bossAssessment.questions.slice(1)) {
      await page.getByTestId(`choice-${q.id}-${q.answerIndex}`).click();
    }

    await expect(page.getByTestId("running-score")).toHaveText("67%");
  });

  test("unknown questId renders the diagnostic not-found surface", async ({ page }) => {
    await page.route(`**/api/engagement/quests/chapter/missing-quest`, (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "quest_not_found", questId: "missing-quest" }),
      }),
    );
    await page.goto(`/dashboard/learner/quests/${WORLD.key}/play/missing-quest`);
    await expect(page.getByText("Quest world not found")).toBeVisible();
    await expect(page.getByTestId("quest-not-found-slug")).toContainText("missing-quest");
  });
});
