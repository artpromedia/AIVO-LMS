import { test, expect, type BrowserContext } from "@playwright/test";

function truthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

const rolloutOn = truthy(process.env.ADMIN_ENTERPRISE_DELEGATED_ADMIN_RBAC_V2);

async function setMockRole(context: BrowserContext, role: string) {
  await context.addCookies([
    {
      name: "aivo_mock_session",
      value: role,
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
}

test.describe("admin RBAC rollout on", () => {
  test.skip(!rolloutOn, "Requires ADMIN_ENTERPRISE_DELEGATED_ADMIN_RBAC_V2=true");

  test("platform admin can create platform staff", async ({ context, page }) => {
    await setMockRole(context, "platform_admin");
    await page.goto("/admin/platform/staff");

    await page.getByPlaceholder("teammate@aivo.com").fill("ops-rbac@aivo.test");
    await page.getByPlaceholder("Jordan Rivera").fill("Ops RBAC");
    await page.selectOption("select", "DEVOPS");
    await page.getByRole("button", { name: "Create" }).click();

    await expect(page.getByText("Created Ops RBAC (DEVOPS).")).toBeVisible();
    await expect(page.getByText("ops-rbac@aivo.test")).toBeVisible();
  });

  test("district admin can create a school and invite subordinate staff", async ({
    context,
    page,
  }) => {
    await setMockRole(context, "district_admin");
    await page.goto("/admin/district/schools");

    await page.getByPlaceholder("Northside Elementary").fill("Northside Launch Academy");
    await page.getByRole("button", { name: "Create school" }).click();
    await expect(page.getByText("Created Northside Launch Academy.")).toBeVisible();

    await page.goto("/admin/district/staff");
    await page.getByRole("button", { name: "Invite staff" }).click();
    await page.getByRole("textbox").nth(0).fill("Taylor Schooladmin");
    await page.getByRole("textbox").nth(1).fill("taylor-schooladmin@aivo.test");
    await page.getByRole("combobox").nth(0).selectOption("school_admin");
    await page.getByRole("combobox").nth(1).selectOption({ index: 1 });
    await page.getByRole("button", { name: "Send invitation" }).click();

    await expect(page.getByText("temporary password", { exact: false })).toBeVisible();
  });

  test("school admin can invite teachers and create learners", async ({ context, page }) => {
    await setMockRole(context, "school_admin");
    await page.goto("/admin/school/staff");

    await page.getByLabel("Full name").fill("Jordan Teacher");
    await page.getByLabel("Email").fill("jordan-teacher@aivo.test");
    await page.getByRole("button", { name: "Send invitation" }).click();
    await expect(page.getByText("Demo mode: created a placeholder invite", { exact: false })).toBeVisible();

    await page.goto("/admin/school/learners");
    await page.getByPlaceholder("Sky Rivera").fill("Rowan Learner");
    await page.getByRole("button", { name: "Create learner" }).click();
    await expect(page.getByText("Created learner Rowan Learner.")).toBeVisible();
    await expect(page.getByText("Rowan Learner")).toBeVisible();
  });

  test("platform staff nav is filtered by capability", async ({ context, page }) => {
    await setMockRole(context, "marketing");
    await page.goto("/admin/platform");

    await expect(page.getByRole("link", { name: "Reports" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Staff" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Billing" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Security" })).toHaveCount(0);
  });
});

test.describe("admin RBAC rollout off", () => {
  test.skip(rolloutOn, "Covers legacy behavior only when the rollout flag is off");

  test("legacy admin routes still work", async ({ context, page }) => {
    await setMockRole(context, "platform_admin");
    await page.goto("/admin/platform/users");
    await expect(page.getByText("unique", { exact: false })).toBeVisible();

    await setMockRole(context, "district_admin");
    await page.goto("/admin/district/staff");
    await expect(page.getByRole("button", { name: "Invite staff" })).toBeVisible();

    await setMockRole(context, "school_admin");
    await page.goto("/admin/school/staff");
    await expect(page.getByText("Invite a teacher")).toBeVisible();
  });
});
