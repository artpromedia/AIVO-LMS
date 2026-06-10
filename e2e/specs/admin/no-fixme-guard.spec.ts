/**
 * No-stub contract guard: every spec under e2e/specs/admin must be a real,
 * runnable journey. The only permitted skips are the environment guards
 * (skipUnlessIdentityTestMode / skipUnlessAdminSvcTestMode /
 * skipUnlessWebReachable) — `test.fixme` stubs are forbidden. Pre-contract
 * journeys live in e2e/specs/admin-legacy until they are implemented.
 */
import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Built by concatenation so this guard never matches itself.
const FORBIDDEN = new RegExp("test\\s*\\.\\s*" + "fixme\\s*\\(");

test("specs/admin contains no test stubs", () => {
  // Playwright transpiles specs to CJS, so __dirname is the reliable anchor.
  const dir = __dirname;
  const offenders: string[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".spec.ts")) continue;
    const source = readFileSync(path.join(dir, file), "utf8");
    if (FORBIDDEN.test(source)) offenders.push(file);
  }
  expect(offenders, `test stubs found in: ${offenders.join(", ")}`).toEqual([]);
});
