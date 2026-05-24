/**
 * Smoke test for the Sprint 2.2 importer. Validates the bundled
 * `fixtures/k2-baseline/bank.json` fixture loads cleanly and produces
 * the expected coverage shape (≥80 items spread across 4 subjects and
 * 3 grade bands).
 */
import { describe, expect, it } from "vitest";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { runImport } from "../cli/import.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(here, "../../fixtures/k2-baseline");

describe("item-bank importer", () => {
  it("loads the K-2 baseline fixture without errors", async () => {
    const result = await runImport({ inputDir: FIXTURE_DIR });
    expect(result.failed, JSON.stringify(result.failed, null, 2)).toHaveLength(0);
    expect(result.imported.length).toBeGreaterThanOrEqual(80);
    expect(result.bankId).toBe("k2-baseline-fall-2026");
  });

  it("produces a coverage report across math/reading/science/writing × K/1/2", async () => {
    const result = await runImport({ inputDir: FIXTURE_DIR });
    const subjects = new Set(Object.keys(result.coverage.bySubject));
    for (const s of ["math", "reading", "science", "writing"]) {
      expect(subjects, `missing ${s}`).toContain(s);
    }
    const gradeBands = new Set(Object.keys(result.coverage.byGradeBand));
    for (const g of ["K", "1", "2"]) {
      expect(gradeBands, `missing band ${g}`).toContain(g);
    }
  });
});
