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
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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

  it("ships behavioral tutor parity for agentic guidance and structured lessons", () => {
    const tutorScreen = readFileSync(join(LEARNER_ROOT, "tutor", "[tutorSlug].tsx"), "utf8");
    for (const required of [
      "useStartSession",
      "useSendMessage",
      "useEndSession",
      "useSpeechInput",
      "Speech.speak",
      'sessionType: "agentic_guidance"',
      "sessionClient.startSession",
    ]) {
      expect(tutorScreen, `mobile tutor screen missing ${required}`).toContain(required);
    }
  });

  it("exposes the Calm Corner self-regulation screen", () => {
    // calm.tsx is the learner's self-regulation surface, deep-linked from the
    // homework focus nudge (?action=…). Dropping it would dead-end the nudge.
    expect(isFile("calm.tsx"), "missing learner screen: calm.tsx").toBe(true);
    const layout = readFileSync(join(LEARNER_ROOT, "_layout.tsx"), "utf8");
    // Registered as a hidden tab (href: null) so it never shows a tab bar item.
    expect(layout).toContain('name="calm"');
    expect(layout).toContain("href: null");
  });

  it("lists every domain tutor on the learner home screen", () => {
    const learnerHome = readFileSync(join(LEARNER_ROOT, "index.tsx"), "utf8");
    expect(learnerHome).toContain("const domainTutors = Object.entries(TUTORS)");
    expect(learnerHome).not.toContain('t.tier === "core"');
  });
});
