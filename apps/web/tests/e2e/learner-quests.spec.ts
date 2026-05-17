import { test, expect } from "@playwright/test";

/**
 * E2E for the Quest Worlds list → detail routing hotfix.
 *
 * Reproduces the production regression: clicking Nova on
 * /dashboard/learner/quests must open the Nova detail surface and
 * must NOT render "Quest world not found".
 *
 * All engagement-svc traffic is mocked here so the test runs without a
 * backend. The canonical Quest World registry on the server is covered
 * by services/engagement-svc/tests/quest-worlds.test.ts.
 */

const QUEST_WORLDS = [
  {
    key: "nova_number_galaxy",
    name: "Nova's Number Galaxy",
    tutorKey: "nova",
    subject: "Mathematics",
    description: "Explore the cosmos of numbers with Nova!",
    chapters: 5,
  },
  {
    key: "sage_story_kingdom",
    name: "Sage's Story Kingdom",
    tutorKey: "sage",
    subject: "English Language Arts",
    description: "Journey through the kingdom of stories with Sage!",
    chapters: 5,
  },
];

test.describe("learner quest worlds routing", () => {
  const LEARNER = {
    id: "learner-1",
    email: "learner@aivo.test",
    name: "Test Learner",
    role: "LEARNER",
    tenantId: "t1",
  };

  test.beforeEach(async ({ page }) => {
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
        body: JSON.stringify([{ id: LEARNER.id, userId: LEARNER.id, gradeLevel: "3" }]),
      }),
    );

    await page.route("**/api/engagement/quests/worlds", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(QUEST_WORLDS),
      }),
    );

    await page.route("**/api/engagement/quests/worlds/*", (route) => {
      const url = new URL(route.request().url());
      const slug = decodeURIComponent(url.pathname.split("/").pop() ?? "");
      const world = QUEST_WORLDS.find((w) => w.key === slug || w.tutorKey === slug);
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
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      }),
    );

    await page.route("**/api/engagement/quests/nova_number_galaxy", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ world: QUEST_WORLDS[0], quests: [] }),
      }),
    );
  });

  test("Quest Worlds list renders Nova card", async ({ page }) => {
    await page.goto("/dashboard/learner/quests");
    await expect(page.getByText("Nova's Number Galaxy")).toBeVisible();
  });

  test("clicking Nova opens Nova detail without 'Quest world not found'", async ({ page }) => {
    await page.goto("/dashboard/learner/quests");
    await page.getByText("Nova's Number Galaxy").click();
    await expect(page).toHaveURL(/\/dashboard\/learner\/quests\/nova_number_galaxy$/);
    await expect(page.getByRole("heading", { name: "Nova's Number Galaxy" })).toBeVisible();
    await expect(page.getByText("Quest world not found")).toHaveCount(0);
  });

  test("tutor-key alias resolves to the same world", async ({ page }) => {
    await page.goto("/dashboard/learner/quests/nova");
    await expect(page.getByRole("heading", { name: "Nova's Number Galaxy" })).toBeVisible();
    await expect(page.getByText("Quest world not found")).toHaveCount(0);
  });

  test("unknown slug renders the diagnostic not-found surface", async ({ page }) => {
    await page.goto("/dashboard/learner/quests/definitely_not_a_world");
    await expect(page.getByText("Quest world not found")).toBeVisible();
    await expect(page.getByTestId("quest-not-found-slug")).toHaveText("definitely_not_a_world");
    await expect(page.getByRole("link", { name: /back/i })).toBeVisible();
  });
});
