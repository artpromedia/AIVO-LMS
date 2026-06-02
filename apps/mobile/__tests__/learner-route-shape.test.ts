/**
 * Sprint 10 — mobile learner route-shape smoke test.
 *
 * Asserts the `(learner)/` Expo Router group still exposes the screens
 * the learner UX depends on (dashboard, tutor, stage, homework, quests,
 * gamification, settings). Renaming or removing one of these without
 * updating the tab map / deep links is a class of regression that
 * shipped to TestFlight before — this catches it at PR time without
 * needing to boot the Expo runtime.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const LEARNER_ROOT = join(__dirname, "..", "app", "(learner)");

function exists(...parts: string[]): boolean {
  return existsSync(join(LEARNER_ROOT, ...parts));
}

function isFile(...parts: string[]): boolean {
  return (
    existsSync(join(LEARNER_ROOT, ...parts)) && statSync(join(LEARNER_ROOT, ...parts)).isFile()
  );
}

function isDir(...parts: string[]): boolean {
  return (
    existsSync(join(LEARNER_ROOT, ...parts)) && statSync(join(LEARNER_ROOT, ...parts)).isDirectory()
  );
}

describe("mobile (learner) route group", () => {
  it("contains the Expo Router layout file", () => {
    expect(isFile("_layout.tsx")).toBe(true);
  });

  it("exposes the dashboard entry (index.tsx)", () => {
    expect(isFile("index.tsx")).toBe(true);
  });

  it("ships every learner-screen the audit calls out", () => {
    const required = [
      "adventure.tsx",
      "badges.tsx",
      // NB: brain.tsx intentionally removed — brain stats now live in the
      // parent dashboard so the learner interface stays learning-only.
      "challenges.tsx",
      "gamification.tsx",
      "gradebook.tsx",
      "leaderboard.tsx",
      "settings.tsx",
      "shop.tsx",
    ];
    for (const file of required) {
      expect(isFile(file), `missing learner screen: ${file}`).toBe(true);
    }
  });

  it("exposes the nested route groups (homework / quests / stage / tutor)", () => {
    for (const dir of ["homework", "quests", "stage", "tutor"]) {
      expect(isDir(dir), `missing learner route group: ${dir}`).toBe(true);
    }
  });

  it("homework directory exposes an index and a [sessionId] route", () => {
    const files = readdirSync(join(LEARNER_ROOT, "homework"));
    expect(files).toContain("index.tsx");
    // Dynamic-segment file uses Expo Router's [param] convention.
    expect(files.some((f) => /^\[.+\]\.tsx$/.test(f))).toBe(true);
  });

  it("stage directory exposes a dynamic [sessionId] route", () => {
    const files = readdirSync(join(LEARNER_ROOT, "stage"));
    expect(files.some((f) => /^\[.+\]\.tsx$/.test(f))).toBe(true);
  });

  it("does not regress to dropping the world-map dashboard", () => {
    // index.tsx is the world-map dashboard; deleting it would land
    // learners on a 404 after sign-in. The route-audit catches it on
    // the file-system check above; this assertion explains why.
    expect(exists("index.tsx")).toBe(true);
  });
});
