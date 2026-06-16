/**
 * Route-shape smoke test for the parity screens + branded splash added in
 * the parity/splash remediation. Mirrors `learner-route-shape.test.ts`:
 * asserts the screens exist on disk AND are registered in their group
 * `_layout.tsx`, so a rename/remove that would 404 a deep link or drop a
 * tab is caught at PR time without booting Expo.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MOBILE = join(__dirname, "..");

function isFile(...parts: string[]): boolean {
  const p = join(MOBILE, ...parts);
  return existsSync(p) && statSync(p).isFile();
}

function read(...parts: string[]): string {
  return readFileSync(join(MOBILE, ...parts), "utf8");
}

describe("parity screens exist", () => {
  it.each([
    ["app", "(caregiver)", "observations.tsx"],
    ["app", "(teacher)", "reports.tsx"],
    ["app", "(learner)", "lesson-runs.tsx"],
    ["src", "api", "observations.ts"],
    ["src", "api", "passwordRecovery.ts"],
    ["src", "api", "emailVerification.ts"],
    ["components", "SplashGate.tsx"],
  ])("ships %s/%s/%s", (...parts) => {
    expect(isFile(...parts), `missing ${parts.join("/")}`).toBe(true);
  });
});

describe("parity routes are registered in their layout", () => {
  it("caregiver layout registers observations", () => {
    expect(read("app", "(caregiver)", "_layout.tsx")).toMatch(/name="observations"/);
  });
  it("teacher layout registers reports", () => {
    expect(read("app", "(teacher)", "_layout.tsx")).toMatch(/name="reports"/);
  });
  it("learner layout registers lesson-runs", () => {
    expect(read("app", "(learner)", "_layout.tsx")).toMatch(/name="lesson-runs"/);
  });
});

describe("recovery parity is satisfied by the auth group", () => {
  it("keeps the auth forgot-password screen wired to the recovery client", () => {
    expect(isFile("app", "(auth)", "forgot-password.tsx")).toBe(true);
    expect(read("app", "(auth)", "forgot-password.tsx")).toMatch(/requestPasswordReset/);
  });
});

describe("email-verification parity is satisfied by the auth group", () => {
  it("ships the verify-email screen wired to the verification client", () => {
    expect(isFile("app", "(auth)", "verify-email.tsx")).toBe(true);
    expect(read("app", "(auth)", "verify-email.tsx")).toMatch(/verifyEmail/);
  });
  it("registers verify-email in the auth layout", () => {
    expect(read("app", "(auth)", "_layout.tsx")).toMatch(/name="verify-email"/);
  });
});

describe("splash gate is wired into the root layout", () => {
  it("root layout wraps the navigator in SplashGate", () => {
    const layout = read("app", "_layout.tsx");
    expect(layout).toMatch(/SplashGate/);
    expect(layout).toMatch(/<SplashGate ready=/);
  });
});
