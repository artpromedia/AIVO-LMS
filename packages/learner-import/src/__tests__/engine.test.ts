import { describe, it, expect } from "vitest";
import {
  initialProgress,
  processNextChunk,
  runImport,
  dryRunDiff,
  type ImportProgress,
} from "../engine.js";
import { templateCsv } from "../template.js";
import { validateCsv, type NormalizedLearner } from "../validate.js";

function learners(n: number): NormalizedLearner[] {
  return Array.from({ length: n }, (_, i) => ({
    rowNumber: i + 1,
    external_id: `S${i}`,
    first_name: "First",
    last_name: "Last",
    grade: i % 13,
    dob: "2014-09-01",
    email_parent: null,
    language_pref: null,
    iep_flag: false,
    "504_flag": false,
  }));
}

describe("template", () => {
  it("is a downloadable CSV that validates clean against the rules", () => {
    const r = validateCsv(templateCsv(), undefined, { now: new Date("2026-06-01Z") });
    expect(r.missingColumns).toHaveLength(0);
    expect(r.summary.errorRows).toBe(0);
    expect(r.summary.validRows).toBe(2);
  });
});

describe("chunked processing", () => {
  it("advances the cursor and tallies outcomes", () => {
    const rows = learners(10);
    let progress = initialProgress(rows.length);
    const { progress: after } = processNextChunk(rows, progress, 4, () => "created");
    expect(after.cursor).toBe(4);
    expect(after.created).toBe(4);
    expect(after.done).toBe(false);
  });

  it("runImport completes all rows", () => {
    const rows = learners(1000);
    const seen = new Set<string>();
    const final = runImport(
      rows,
      (row) => {
        const dup = seen.has(row.external_id);
        seen.add(row.external_id);
        return dup ? "skipped" : "created";
      },
      { chunkSize: 128 },
    );
    expect(final.done).toBe(true);
    expect(final.created).toBe(1000);
    expect(final.cursor).toBe(1000);
  });
});

describe("resumability (killed mid-run)", () => {
  it("resumes from the persisted cursor and never double-applies a row", () => {
    const rows = learners(1000);
    const applied: string[] = [];
    const apply = (row: NormalizedLearner) => {
      applied.push(row.external_id);
      return "created" as const;
    };

    // Simulate a process that dies after persisting progress at row 350.
    let progress: ImportProgress = initialProgress(rows.length);
    let persisted: ImportProgress = progress;
    let chunks = 0;
    while (!progress.done && chunks < 7) {
      progress = processNextChunk(rows, progress, 50, apply).progress;
      persisted = progress; // "persist" after each chunk
      chunks++;
    }
    expect(persisted.cursor).toBe(350);
    const appliedBeforeCrash = applied.length;

    // New process: rehydrate from persisted cursor and finish.
    const final = runImport(rows, apply, { chunkSize: 50, resumeFrom: persisted });
    expect(final.done).toBe(true);
    expect(final.cursor).toBe(1000);
    // Every row applied exactly once across both runs (no duplicates).
    expect(applied.length).toBe(1000);
    expect(new Set(applied).size).toBe(1000);
    expect(appliedBeforeCrash).toBe(350);
  });
});

describe("performance — 10k rows", () => {
  it("drives 10k rows well under the 90s CI budget", () => {
    const rows = learners(10_000);
    const start = Date.now();
    const final = runImport(rows, () => "created", { chunkSize: 500 });
    const elapsedMs = Date.now() - start;
    expect(final.done).toBe(true);
    expect(final.created).toBe(10_000);
    expect(elapsedMs).toBeLessThan(90_000);
  });
});

describe("dryRunDiff", () => {
  it("splits rows into adds and updates against existing ids", () => {
    const rows = learners(5);
    const existing = new Set(["S0", "S2"]);
    const diff = dryRunDiff(rows, existing);
    expect(diff.adds).toBe(3);
    expect(diff.updates).toBe(2);
    expect(diff.updateRows.map((r) => r.external_id).sort()).toEqual(["S0", "S2"]);
  });
});
