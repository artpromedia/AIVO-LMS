import { test, expect, request as pwRequest } from "@playwright/test";

const BASE_URL = process.env.WEB_BASE_URL || "http://localhost:5000";

async function appReachable(): Promise<boolean> {
  try {
    const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
    const res = await ctx.get("/api/bff/health", { timeout: 2500 });
    await ctx.dispose();
    return res.ok();
  } catch {
    return false;
  }
}

test.describe("parent to learner handoff", () => {
  test.beforeAll(async () => {
    if (!(await appReachable())) {
      test.skip(true, `web app not reachable at ${BASE_URL}`);
    }
  });

  test("handoff route transitions to learner surface", async ({ page, request }) => {
    const login = await request.post(`${BASE_URL}/api/bff/auth/mock-login`, {
      data: { role: "parent" },
    });
    expect(login.ok()).toBeTruthy();

    const [cookie] = (login.headersArray()
      .filter((h) => h.name.toLowerCase() === "set-cookie")
      .map((h) => h.value) ?? []) as string[];
    test.skip(!cookie, "mock auth cookie unavailable");

    await page.context().addCookies([
      {
        name: "aivo_mock_session",
        value: "parent",
        url: BASE_URL,
      },
    ]);

    await page.goto("/parent/learners/lrn_demo_sky/handoff");
    await expect(page).toHaveURL(/\/(learner\/home|parent\/learners\/lrn_demo_sky\/brain-clone-watch)/);
  });
});
