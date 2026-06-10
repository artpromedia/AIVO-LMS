/**
 * Sprint 12 — shared fixtures for the 40 golden-path e2e suites.
 *
 * Every spec under tests/sprint12/* imports from here so the
 * "seed an X user" helpers stay consistent and so a future contract
 * change to identity-svc only requires one update.
 *
 * Each helper auto-skips the calling spec when its prerequisite
 * test-mode helper is unreachable. This lets the full suite run in
 * environments where only some services are up (local dev) without
 * collapsing CI on unrelated red rows.
 */
import { request as pwRequest, test, type APIRequestContext } from "@playwright/test";

export const WEB_BASE = process.env.WEB_BASE_URL || "http://localhost:5000";
/** Standalone admin console (apps/web-admin) — serves on :5001, not :5000. */
export const ADMIN_WEB_BASE = process.env.ADMIN_WEB_BASE_URL || "http://localhost:5001";
export const IDENTITY_BASE = process.env.IDENTITY_BASE_URL || "http://localhost:3001";
export const ASSESSMENT_BASE = process.env.ASSESSMENT_SVC_URL || "http://localhost:3071";
export const AI_BASE = process.env.AI_SVC_URL || "http://localhost:3004";
export const ADMIN_BASE = process.env.ADMIN_SVC_URL || "http://localhost:3005";

export interface SeededUser {
  userId: string;
  tenantId: string;
  accessToken: string;
  email: string;
  password: string;
}

export interface SeededLearner {
  learnerId: string;
  parentUserId: string;
  tenantId: string;
}

/** Probe an identity-svc test-mode endpoint. Returns false when the
 *  helper is missing — caller skips the spec rather than failing.   */
export async function identityTestModeReachable(): Promise<boolean> {
  try {
    const ctx = await pwRequest.newContext({ baseURL: IDENTITY_BASE });
    const res = await ctx.get("/api/__test__/health", { failOnStatusCode: false });
    await ctx.dispose();
    return res.status() === 200;
  } catch {
    return false;
  }
}

/** Skip the active test when identity test-mode helpers are off. */
export async function skipUnlessIdentityTestMode(testInfo = test.info()): Promise<void> {
  if (!(await identityTestModeReachable())) {
    testInfo.skip(true, "identity-svc test-mode helpers unreachable");
  }
}

/** Probe the web-v2 BFF. False when the web app isn't part of the running
 *  stack (e.g. the base compose profile, which only boots the services). */
export async function webReachable(): Promise<boolean> {
  try {
    const ctx = await pwRequest.newContext({ baseURL: WEB_BASE });
    const res = await ctx.get("/api/bff/health", { failOnStatusCode: false });
    await ctx.dispose();
    return res.status() === 200;
  } catch {
    return false;
  }
}

/** Skip the active test when web-v2 isn't up. Browser suites use this so a
 *  services-only harness (no web build) skips them instead of failing on a
 *  dead :5000 — seeding alone succeeding no longer implies the app is up. */
export async function skipUnlessWebReachable(testInfo = test.info()): Promise<void> {
  if (!(await webReachable())) {
    testInfo.skip(true, "web-v2 unreachable (services-only harness)");
  }
}

/** Probe admin-svc's test-mode helpers (ADMIN_TEST_MODE=1: fault injection +
 *  platform-metrics seeds). Same environment-guard contract as the identity
 *  probe — false means the helpers are off, not that the test is stubbed. */
export async function adminSvcTestModeReachable(): Promise<boolean> {
  try {
    const ctx = await pwRequest.newContext({ baseURL: ADMIN_BASE });
    const res = await ctx.get("/api/__test__/health", { failOnStatusCode: false });
    await ctx.dispose();
    return res.status() === 200;
  } catch {
    return false;
  }
}

/** Skip the active test when admin-svc test-mode helpers are off. */
export async function skipUnlessAdminSvcTestMode(testInfo = test.info()): Promise<void> {
  if (!(await adminSvcTestModeReachable())) {
    testInfo.skip(true, "admin-svc test-mode helpers unreachable");
  }
}

async function seedUser(role: string, email: string, password: string): Promise<SeededUser | null> {
  try {
    const ctx = await pwRequest.newContext({ baseURL: IDENTITY_BASE });
    try {
      const res = await ctx.post(`/api/__test__/seed-${role}`, {
        data: { email, password },
        failOnStatusCode: false,
      });
      if (res.status() !== 200) return null;
      // Read the body BEFORE dispose — disposing the context disposes its
      // responses, and json() then throws (playwright >= 1.5x).
      const body = (await res.json()) as Omit<SeededUser, "email" | "password">;
      return { ...body, email, password };
    } finally {
      await ctx.dispose();
    }
  } catch {
    return null;
  }
}

export const seedParent = (email = `e2e-parent-${Date.now()}@aivo.test`) =>
  seedUser("parent", email, "E2eParent!Pass1");

/** Seed a PARENT directly INTO an existing tenant (e.g. a district tenant) so
 *  the district-pilot e2e can drive web-v2 learner-create under the seat cap. */
export async function seedParentInTenant(
  tenantId: string,
  email = `e2e-dparent-${Date.now()}@aivo.test`,
): Promise<SeededUser | null> {
  const password = "E2eParent!Pass1";
  try {
    const ctx = await pwRequest.newContext({ baseURL: IDENTITY_BASE });
    try {
      const res = await ctx.post(`/api/__test__/seed-parent`, {
        data: { email, password, tenantId },
        failOnStatusCode: false,
      });
      if (res.status() !== 200) return null;
      const body = (await res.json()) as Omit<SeededUser, "email" | "password">;
      return { ...body, email, password };
    } finally {
      await ctx.dispose();
    }
  } catch {
    return null;
  }
}
export const seedTeacher = (email = `e2e-teacher-${Date.now()}@aivo.test`) =>
  seedUser("teacher", email, "E2eTeacher!Pass1");
export const seedTherapist = (email = `e2e-therapist-${Date.now()}@aivo.test`) =>
  seedUser("therapist", email, "E2eTherapist!Pass1");
export const seedCaregiver = (email = `e2e-caregiver-${Date.now()}@aivo.test`) =>
  seedUser("caregiver", email, "E2eCaregiver!Pass1");
export const seedSchoolAdmin = (email = `e2e-school-${Date.now()}@aivo.test`) =>
  seedUser("school-admin", email, "E2eSchool!Pass1");

/** Seed a DISTRICT_ADMIN with a real bearer token and an optional pilot seat
 *  cap on its tenant. Used by the Sprint 2 parent-invite e2e. */
export async function seedDistrictAdmin(
  opts: { email?: string; seatLimit?: number } = {},
): Promise<(SeededUser & { tenantId: string }) | null> {
  const email = opts.email ?? `e2e-district-${Date.now()}@aivo.test`;
  const password = "E2eDistrict!Pass1";
  try {
    const ctx = await pwRequest.newContext({ baseURL: IDENTITY_BASE });
    try {
      const res = await ctx.post(`/api/__test__/seed-district-admin`, {
        data: { email, password, seatLimit: opts.seatLimit },
        failOnStatusCode: false,
      });
      if (res.status() !== 200) return null;
      const body = (await res.json()) as { userId: string; tenantId: string; accessToken: string };
      return {
        userId: body.userId,
        tenantId: body.tenantId,
        accessToken: body.accessToken,
        email,
        password,
      };
    } finally {
      await ctx.dispose();
    }
  } catch {
    return null;
  }
}
export const seedPlatformAdmin = (email = `e2e-platform-${Date.now()}@aivo.test`) =>
  seedUser("platform-admin", email, "E2ePlat!Pass1");
/** Tenant-less SUPPORT platform-staff user (non-admin platform role). */
export const seedSupportStaff = (email = `e2e-support-${Date.now()}@aivo.test`) =>
  seedUser("support", email, "E2eSupport!Pass1");

export async function seedLearnerForParent(parent: SeededUser): Promise<SeededLearner | null> {
  try {
    const ctx = await pwRequest.newContext({ baseURL: IDENTITY_BASE });
    try {
      const res = await ctx.post(`/api/__test__/seed-learner`, {
        data: { parentUserId: parent.userId, tenantId: parent.tenantId },
        failOnStatusCode: false,
      });
      if (res.status() !== 200) return null;
      return (await res.json()) as SeededLearner;
    } finally {
      await ctx.dispose();
    }
  } catch {
    return null;
  }
}

/** Authenticate the browser by setting the session cookie issued by
 *  identity-svc's test-mode endpoint. Falls back to a Bearer header
 *  injected via a route handler when the cookie path is unavailable.  */
export async function authenticateBrowser(
  page: import("@playwright/test").Page,
  user: SeededUser,
): Promise<void> {
  await page.context().addCookies([
    {
      name: "aivo_session",
      value: user.accessToken,
      url: WEB_BASE,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/**
 * Authenticate the browser against the STANDALONE admin console
 * (apps/web-admin on :5001). web-admin reads two cookies: the identity-svc
 * RS256 access token (verified against the shared JWT public key) plus the
 * `aivo_session` profile snapshot whose userId/tenantId/role must match the
 * token claims — see packages/admin-auth/src/server.ts.
 */
export async function authenticateAdminBrowser(
  page: import("@playwright/test").Page,
  user: SeededUser,
  role: "platform_admin" | "district_admin" | "school_admin" | "support" = "platform_admin",
): Promise<void> {
  const profile = {
    userId: user.userId,
    // identity-svc mints platform-staff tokens with tenantId null; the admin
    // session cookie stores that as "" (claims.tenantId ?? "" must match).
    tenantId: user.tenantId ?? "",
    role,
    email: user.email,
    displayName: "E2E Admin",
    permissions: [],
  };
  await page.context().addCookies([
    {
      name: "aivo_access_token",
      value: user.accessToken,
      url: ADMIN_WEB_BASE,
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: "aivo_session",
      value: encodeURIComponent(JSON.stringify(profile)),
      url: ADMIN_WEB_BASE,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/** Convenience: hit a BFF route from within the test runner without a
 *  browser (used for setup steps that shouldn't count as "user flow"). */
export async function bff(
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {},
): Promise<{ status: number; json: unknown }> {
  const ctx: APIRequestContext = await pwRequest.newContext({ baseURL: WEB_BASE });
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.token) headers["authorization"] = `Bearer ${init.token}`;
  const res = await ctx.fetch(path, {
    method: init.method ?? "GET",
    headers,
    data: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    failOnStatusCode: false,
  });
  const status = res.status();
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* noop */
  }
  await ctx.dispose();
  return { status, json };
}

/** Stable selectors. Every Sprint 7-11 page exposes these
 *  data-testid hooks; collecting them here so a future selector
 *  rename only touches one file. */
export const T = {
  schoolName: "school-name",
  schoolKpis: "school-kpis",
  schoolEmpty: "school-empty-state",
  observationSubmit: "observation-form-submit",
  observationError: "observation-form-error",
  flagEnvvar: "flag-envvar",
  // web-admin /platform — usage-trends widget (charting foundation sprint).
  platformUsageTrends: "platform-usage-trends",
  platformUsageTrendsNewUsers: "platform-usage-trends-new-users",
  platformUsageTrendsNewLearners: "platform-usage-trends-new-learners",
  platformUsageTrendsError: "platform-usage-trends-error",
  // web-admin /platform/__chart-check — chart primitive self-test harness.
  chartCheckArea: "chart-check-area",
  chartCheckDonut: "chart-check-donut",
  chartCheckBars: "chart-check-bars",
  chartCheckGauge: "chart-check-gauge",
  chartCheckFunnel: "chart-check-funnel",
  chartCheckKpi: "chart-check-kpi",
  chartCheckSparkline: "chart-check-sparkline",
  // web-admin /platform — operations dashboard panels (Sprint: overview).
  platformQuickActions: "platform-quick-actions",
  platformKpiTenants: "platform-kpi-tenants",
  platformKpiUsers: "platform-kpi-users",
  platformKpiLearners: "platform-kpi-learners",
  platformKpiAiCost: "platform-kpi-ai-cost",
  platformAiRequests: "platform-ai-requests",
  platformTenantMix: "platform-tenant-mix",
  platformCompletionGauge: "platform-completion-gauge",
  platformTrialFunnel: "platform-trial-funnel",
  platformPilotsTable: "platform-pilots-table",
  pilotRow: "pilot-row",
  // web-admin platform app shell (grouped sidebar + top bar).
  adminShell: "admin-shell",
  adminShellSidebar: "admin-shell-sidebar",
  adminShellBreadcrumbs: "admin-shell-breadcrumbs",
  adminShellSearch: "admin-shell-search",
  adminShellMenu: "admin-shell-menu",
  navGroupIdentityAccess: "nav-group-identity-access",
  navGroupAiGovernance: "nav-group-ai-governance",
  navGroupBillingGrowth: "nav-group-billing-growth",
  navGroupComplianceTrust: "nav-group-compliance-trust",
  navGroupOperations: "nav-group-operations",
  // Inner hooks rendered by the @aivo/admin-ui primitives themselves.
  donutCenterTotal: "donut-center-total",
  gaugeCenterLabel: "gauge-center-label",
  kpiValue: "kpi-value",
  kpiDelta: "kpi-delta",
} as const;

/** data-testid of a panel's degraded state (see web-admin PanelError). */
export function tErr(panelTestId: string): string {
  return `${panelTestId}-error`;
}
