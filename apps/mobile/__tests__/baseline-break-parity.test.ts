/**
 * C-09 — mobile/web baseline pacing parity.
 *
 * The break cadence drifted (web 5, mobile 3), so a learner moving between
 * devices got a different rhythm. The canonical value now lives in
 * `@aivo/adaptive-baseline` as `BASELINE_BREAK_EVERY`; the mobile runner
 * MIRRORS it as a literal (the adaptive engine is not bundled into the RN app
 * — see apps/mobile/metro.config.js watch folders). These tests keep the
 * mirror honest and prove the subject list is no longer hardcoded.
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

describe("baseline break cadence parity (mobile mirror ↔ canonical)", () => {
  it("the canonical constant is 5", () => {
    expect(BASELINE_BREAK_EVERY).toBe(5);
  });

  it("the mobile runner mirrors the canonical cadence exactly", () => {
    // Extract the literal the mobile runner uses and assert it equals the
    // shared source of truth. If someone edits one without the other, this
    // fails — which is the whole point of the mirror+parity pattern.
    const match = runSrc.match(/const\s+BREAK_EVERY\s*=\s*(\d+)\s*;/);
    expect(match, "BREAK_EVERY literal not found in run.tsx").not.toBeNull();
    const mobileValue = Number(match![1]);
    expect(mobileValue).toBe(BASELINE_BREAK_EVERY);
  });

  it("the mobile runner no longer uses the old cadence of 3", () => {
    expect(runSrc).not.toMatch(/const\s+BREAK_EVERY\s*=\s*3\s*;/);
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
