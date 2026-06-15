/**
 * C-09 — mobile baseline pacing + adaptivity wiring.
 *
 * The break cadence once drifted (web 5, mobile 3), so a learner moving
 * between devices got a different rhythm. The canonical value now lives in
 * `@aivo/adaptive-baseline` as `BASELINE_BREAK_EVERY`, and the mobile runner
 * IMPORTS it (the adaptive engine is now a mobile runtime dependency / Metro
 * watch folder), instead of mirroring a literal. These tests prove the runner
 * is wired to the real engine and no longer carries a hard-coded cadence, and
 * that the subject list is no longer hardcoded.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BASELINE_BREAK_EVERY } from "@aivo/adaptive-baseline";

const here = dirname(fileURLToPath(import.meta.url));
const runSrc = readFileSync(
  resolve(here, "../app/(learner)/baseline/run.tsx"),
  "utf8",
);
const indexSrc = readFileSync(
  resolve(here, "../app/(learner)/baseline/index.tsx"),
  "utf8",
);

describe("baseline break cadence is the shared canonical value", () => {
  it("the canonical constant is 5", () => {
    expect(BASELINE_BREAK_EVERY).toBe(5);
  });

  it("the mobile runner imports the cadence from the engine, not a literal", () => {
    expect(runSrc).toMatch(/import\s*\{[^}]*BASELINE_BREAK_EVERY[^}]*\}\s*from\s*["']@aivo\/adaptive-baseline["']/s);
    expect(runSrc).toMatch(/\bBASELINE_BREAK_EVERY\b/);
  });

  it("the mobile runner no longer hard-codes a BREAK_EVERY literal", () => {
    expect(runSrc).not.toMatch(/const\s+BREAK_EVERY\s*=\s*\d+\s*;/);
  });
});

describe("baseline item selection is engine-driven, not a static index walk", () => {
  it("the runner drives selection through the adaptive engine", () => {
    expect(runSrc).toMatch(/\bpickNextItem\b/);
    expect(runSrc).toMatch(/\brecordResponse\b/);
    expect(runSrc).toMatch(/\bshouldStop\b/);
  });
});

describe("baseline read-aloud is functional, not just declarative", () => {
  it("the runner imports a real TTS engine (expo-speech)", () => {
    expect(runSrc).toMatch(/from\s*["']expo-speech["']/);
    expect(runSrc).toMatch(/Speech\.speak\(/);
  });

  it("exposes a learner-facing read-aloud control with an accessible label", () => {
    expect(runSrc).toMatch(/baselineRun\.playQuestion/);
    expect(runSrc).toMatch(/accessibilityLabel=\{t\(\s*["']baselineRun\.playQuestion["']/);
  });

  it("auto-presents items aurally on the audio-first path", () => {
    // The auto-speak effect speaks the current item whenever audio-first is on
    // (PRE_SYMBOLIC / NON_VERBAL / LOW_VERBAL, or learner-selected listen mode).
    expect(runSrc).toMatch(/!audioFirst\)\s*return/);
    expect(runSrc).toMatch(/speakText\(/);
  });

  it("cancels in-flight speech when the learner answers or skips", () => {
    // respond() must stop any prior utterance (manual Play or auto-speak) so it
    // never bleeds into the next prompt — independent of functioning level.
    const respondIdx = runSrc.indexOf("const respond =");
    const guardIdx = runSrc.indexOf("if (!item || !engItem) return;", respondIdx);
    expect(respondIdx).toBeGreaterThan(-1);
    const respondHead = runSrc.slice(respondIdx, guardIdx);
    expect(respondHead).toMatch(/Speech\.stop\(\)/);
  });
});

describe("baseline subjects come from data, not a hardcoded list", () => {
  it("the pre-flight no longer declares a hardcoded SUBJECTS array", () => {
    // The previous regression was: const SUBJECTS = ["Math", "Reading", ...].
    expect(indexSrc).not.toMatch(/const\s+SUBJECTS\s*=\s*\[/);
    expect(indexSrc).not.toMatch(/\[\s*"Math"\s*,\s*"Reading"/);
  });

  it("the pre-flight fetches subjects from the baseline client", () => {
    expect(indexSrc).toMatch(/fetchBaselineSubjects/);
  });
});
