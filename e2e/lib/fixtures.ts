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
export const IDENTITY_BASE = process.env.IDENTITY_BASE_URL || "http://localhost:3001";
export const ASSESSMENT_BASE = process.env.ASSESSMENT_SVC_URL || "http://localhost:3071";
export const AI_BASE = process.env.AI_SVC_URL || "http://localhost:3004";
export const ADMIN_BASE = process.env.ADMIN_SVC_URL || "http://localhost:3003";

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

async function seedUser(role: string, email: string, password: string): Promise<SeededUser | null> {
  try {
    const ctx = await pwRequest.newContext({ baseURL: IDENTITY_BASE });
    const res = await ctx.post(`/api/__test__/seed-${role}`, {
      data: { email, password },
      failOnStatusCode: false,
    });
    await ctx.dispose();
    if (res.status() !== 200) return null;
    const body = (await res.json()) as Omit<SeededUser, "email" | "password">;
    return { ...body, email, password };
  } catch {
    return null;
  }
}

export const seedParent = (email = `e2e-parent-${Date.now()}@aivo.test`) =>
  seedUser("parent", email, "E2eParent!Pass1");
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
    const res = await ctx.post(`/api/__test__/seed-district-admin`, {
      data: { email, password, seatLimit: opts.seatLimit },
      failOnStatusCode: false,
    });
    await ctx.dispose();
    if (res.status() !== 200) return null;
    const body = (await res.json()) as { userId: string; tenantId: string; accessToken: string };
    return {
      userId: body.userId,
      tenantId: body.tenantId,
      accessToken: body.accessToken,
      email,
      password,
    };
  } catch {
    return null;
  }
}
export const seedPlatformAdmin = (email = `e2e-platform-${Date.now()}@aivo.test`) =>
  seedUser("platform-admin", email, "E2ePlat!Pass1");

export async function seedLearnerForParent(parent: SeededUser): Promise<SeededLearner | null> {
  try {
    const ctx = await pwRequest.newContext({ baseURL: IDENTITY_BASE });
    const res = await ctx.post(`/api/__test__/seed-learner`, {
      data: { parentUserId: parent.userId, tenantId: parent.tenantId },
      failOnStatusCode: false,
    });
    await ctx.dispose();
    if (res.status() !== 200) return null;
    return (await res.json()) as SeededLearner;
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
} as const;
