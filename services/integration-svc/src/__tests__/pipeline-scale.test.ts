import { describe, it, expect } from "vitest";
import { emptySnapshot, type RosterSnapshot, type User } from "../types/canonical.js";
import { normalizeSnapshot } from "../pipeline/transform.js";
import { computeDiff, isEmptyDiff } from "../pipeline/diff.js";
import { applyDiff } from "../pipeline/apply.js";
import { RecordingRosterWriter } from "../pipeline/load.js";

/** Build a synthetic OneRoster snapshot with `n` users across 50 schools. */
function syntheticSnapshot(n: number): RosterSnapshot {
  const snap = emptySnapshot("oneroster");
  for (let i = 0; i < 50; i++) {
    snap.orgs.push({ provider: "oneroster", sourcedId: `sch-${i}`, status: "active", name: `School ${i}`, type: "school" });
  }
  const users: User[] = new Array(n);
  for (let i = 0; i < n; i++) {
    users[i] = {
      provider: "oneroster",
      sourcedId: `usr-${i}`,
      status: "active",
      enabled: true,
      givenName: `First${i}`,
      familyName: `Last${i}`,
      email: `user${i}@district.k12`,
      roles: ["student"],
      primaryRole: "student",
      grades: [String((i % 12) + 1).padStart(2, "0")],
      orgSourcedIds: [`sch-${i % 50}`],
    };
  }
  snap.users = users;
  return snap;
}

describe("pipeline at scale (50k rows)", () => {
  it("first run adds all rows; second run is idempotent (0 diffs); within time budget", async () => {
    const N = 50_000;
    const t0 = Date.now();

    const incoming = normalizeSnapshot(syntheticSnapshot(N));

    // First sync: prev is empty → everything is an add.
    const firstDiff = computeDiff(emptySnapshot("oneroster"), incoming);
    expect(firstDiff.counts.users.added).toBe(N);

    const writer = new RecordingRosterWriter();
    const applied = await applyDiff(firstDiff, writer, {
      population: N + 50,
      overrideCap: true, // initial bulk import is an approved large change
    });
    expect(applied.applied).toBe(true);
    // 50k users + 50 orgs upserted.
    expect(writer.ops.length).toBe(N + 50);

    // Second sync against the now-loaded state: zero changes.
    const secondDiff = computeDiff(incoming, normalizeSnapshot(syntheticSnapshot(N)));
    expect(isEmptyDiff(secondDiff)).toBe(true);

    const elapsed = Date.now() - t0;
    // Pure CPU pipeline over 50k rows must be comfortably fast (the 10-min
    // DoD budget is for the DB-backed run; this pins the in-memory core).
    expect(elapsed).toBeLessThan(10_000);
  });
});
