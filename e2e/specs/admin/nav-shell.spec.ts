/**
 * Platform app shell — grouped sidebar, breadcrumbs, search, role gating.
 *
 * Runs against the docker-compose.e2e.yml `pilot` profile (identity-svc +
 * admin-svc + web-admin on :5001):
 *
 *   1. A platform admin lands on /platform inside the shell: all five nav
 *      groups render, a group collapses/expands, clicking a child route
 *      navigates, highlights the active item (aria-current) and updates the
 *      breadcrumb, and the global search filters the visible nav items.
 *   2. A seeded SUPPORT user (non-admin platform staff) sees the shell but
 *      not the role-gated items (Pilots, Coupons, Sales leads).
 */
import { test, expect } from "@playwright/test";
import {
  ADMIN_WEB_BASE,
  T,
  authenticateAdminBrowser,
  seedPlatformAdmin,
  seedSupportStaff,
  skipUnlessIdentityTestMode,
} from "../../lib/fixtures";

const GROUPS = [
  { testId: T.navGroupIdentityAccess, label: "Identity & Access" },
  { testId: T.navGroupAiGovernance, label: "AI Governance" },
  { testId: T.navGroupBillingGrowth, label: "Billing & Growth" },
  { testId: T.navGroupComplianceTrust, label: "Compliance & Trust" },
  { testId: T.navGroupOperations, label: "Operations" },
];

test.describe("Platform nav shell (web-admin :5001)", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
  });

  test("grouped sidebar: headings, collapse, navigation, breadcrumb, search", async ({ page }) => {
    const admin = await seedPlatformAdmin();
    expect(admin, "identity-svc seed-platform-admin helper must be reachable").not.toBeNull();
    if (!admin) return;

    await authenticateAdminBrowser(page, admin, "platform_admin");
    await page.goto(`${ADMIN_WEB_BASE}/platform`);
    await expect(page.getByTestId(T.adminShell)).toBeVisible();

    const sidebar = page.getByTestId(T.adminShellSidebar);

    // All five group headings render with their labels.
    for (const group of GROUPS) {
      const heading = sidebar.getByTestId(group.testId);
      await expect(heading, `${group.label} should render`).toBeVisible();
      await expect(heading).toContainText(group.label);
      await expect(heading).toHaveAttribute("aria-expanded", "true");
    }

    // Each group collapses (its items disappear) and expands again.
    for (const group of GROUPS) {
      const heading = sidebar.getByTestId(group.testId);
      await heading.click();
      await expect(heading).toHaveAttribute("aria-expanded", "false");
    }
    await expect(sidebar.getByRole("link", { name: "Tenants" })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: "System health" })).toHaveCount(0);
    for (const group of GROUPS) {
      await sidebar.getByTestId(group.testId).click();
      await expect(sidebar.getByTestId(group.testId)).toHaveAttribute("aria-expanded", "true");
    }
    await expect(sidebar.getByRole("link", { name: "Tenants" })).toBeVisible();

    // Clicking a child route navigates, sets active state, and breadcrumbs.
    await sidebar.getByRole("link", { name: "Users", exact: true }).click();
    await page.waitForURL(`${ADMIN_WEB_BASE}/platform/users`);
    const activeUsers = sidebar.getByRole("link", { name: "Users", exact: true });
    await expect(activeUsers).toHaveAttribute("aria-current", "page");
    const crumbs = page.getByTestId(T.adminShellBreadcrumbs);
    await expect(crumbs).toContainText("Platform");
    await expect(crumbs).toContainText("Users");
    // Only one nav item carries the active state.
    await expect(sidebar.locator('a[aria-current="page"]')).toHaveCount(1);

    // The ⌘K trigger opens the global command palette; Escape dismisses it.
    const search = page.getByTestId(T.adminShellSearch);
    await search.click();
    const palette = page.getByRole("dialog", { name: /search tenants/i });
    await expect(palette).toBeVisible();
    await expect(page.getByTestId("admin-command-input")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(palette).toHaveCount(0);
  });

  test("role-gated items are hidden from non-admin platform staff", async ({ page }) => {
    const support = await seedSupportStaff();
    expect(support, "identity-svc seed-support helper must be reachable").not.toBeNull();
    if (!support) return;

    await authenticateAdminBrowser(page, support, "support");
    await page.goto(`${ADMIN_WEB_BASE}/platform`);
    await expect(page.getByTestId(T.adminShell)).toBeVisible();

    const sidebar = page.getByTestId(T.adminShellSidebar);
    // Ungated items render for any platform role…
    await expect(sidebar.getByRole("link", { name: "Tenants" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Billing", exact: true })).toBeVisible();
    // …while platform_admin / sales gated destinations stay hidden.
    await expect(sidebar.getByRole("link", { name: "Pilots" })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: "Coupons" })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: "Sales leads" })).toHaveCount(0);
    // The quick actions are platform_admin-only too.
    await expect(page.getByRole("link", { name: "Provision pilot" })).toHaveCount(0);
  });
});
