import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseOneRosterCsv } from "../connectors/oneroster/csv.js";
import { normalizeSnapshot } from "../pipeline/transform.js";
import { computeDiff, isEmptyDiff } from "../pipeline/diff.js";
import { applyDiff, exceedsCap, type RosterWriter } from "../pipeline/apply.js";
import { reconcile } from "../pipeline/reconcile.js";
import { emptySnapshot, type RosterSnapshot } from "../types/canonical.js";

const DIR = join(__dirname, "../../tests/fixtures/oneroster_v1p2");
const read = (f: string) => readFileSync(join(DIR, f), "utf8");
function loadSnapshot(): RosterSnapshot {
  return parseOneRosterCsv({
    orgs: read("orgs.csv"),
    academicSessions: read("academicSessions.csv"),
    courses: read("courses.csv"),
    classes: read("classes.csv"),
    users: read("users.csv"),
    enrollments: read("enrollments.csv"),
  });
}

function shuffle<T>(arr: T[], seed = 7): T[] {
  const out = arr.slice();
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

describe("transform.normalizeSnapshot — idempotent + order-independent", () => {
  const snap = loadSnapshot();

  it("is idempotent: normalize(normalize(s)) === normalize(s)", () => {
    const once = normalizeSnapshot(snap);
    const twice = normalizeSnapshot(once);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });

  it("is order-independent: shuffled input normalizes to the same canonical form", () => {
    const shuffled: RosterSnapshot = {
      ...snap,
      users: shuffle(snap.users),
      orgs: shuffle(snap.orgs),
      classes: shuffle(snap.classes),
      enrollments: shuffle(snap.enrollments),
    };
    expect(JSON.stringify(normalizeSnapshot(shuffled))).toBe(
      JSON.stringify(normalizeSnapshot(snap)),
    );
  });

  it("collapses duplicate sourcedIds (last-write-wins)", () => {
    const dup: RosterSnapshot = {
      ...snap,
      orgs: [...snap.orgs, { ...snap.orgs[0], name: "Renamed" }],
    };
    const norm = normalizeSnapshot(dup);
    const same = norm.orgs.filter((o) => o.sourcedId === snap.orgs[0].sourcedId);
    expect(same).toHaveLength(1);
    expect(same[0].name).toBe("Renamed");
  });
});

describe("diff.computeDiff", () => {
  const base = normalizeSnapshot(loadSnapshot());
  // Internal state never stores `tobedeleted` markers (those are realised
  // as soft-deletes on apply), so the steady-state snapshot is active-only.
  const activeBase = normalizeSnapshot({
    ...base,
    users: base.users.filter((u) => u.status === "active"),
  });

  it("a steady-state snapshot diffed against itself produces zero changes (idempotent sync)", () => {
    expect(isEmptyDiff(computeDiff(activeBase, activeBase))).toBe(true);
  });

  it("detects added, updated, and removed users", () => {
    const next: RosterSnapshot = normalizeSnapshot({
      ...base,
      users: [
        // updated: change a field on an existing user
        { ...base.users[0], familyName: "Changed" },
        ...base.users.slice(1, base.users.length - 1),
        // added
        { ...base.users[0], sourcedId: "usr-new", familyName: "New" },
      ],
    });
    const diff = computeDiff(base, next);
    expect(diff.counts.users.added).toBe(1);
    expect(diff.counts.users.updated).toBe(1);
    // one existing user dropped from the list => removed
    expect(diff.counts.users.removed).toBeGreaterThanOrEqual(1);
  });

  it("treats tobedeleted as a removal", () => {
    const goneId = "usr-s3";
    const next: RosterSnapshot = {
      ...base,
      users: base.users.map((u) =>
        u.sourcedId === goneId ? { ...u, status: "tobedeleted" as const } : u,
      ),
    };
    // Put the tobedeleted user into prev as active so it's a real removal.
    const prev: RosterSnapshot = {
      ...base,
      users: base.users.map((u) =>
        u.sourcedId === goneId ? { ...u, status: "active" as const } : u,
      ),
    };
    const diff = computeDiff(normalizeSnapshot(prev), normalizeSnapshot(next));
    expect(diff.users.removed.some((u) => u.sourcedId === goneId)).toBe(true);
  });
});

describe("apply.applyDiff — safety rails", () => {
  function fakeWriter() {
    const calls: Array<{ op: string; kind: string; id: string }> = [];
    const writer: RosterWriter = {
      async upsert(kind, rec) {
        calls.push({ op: "upsert", kind, id: rec.sourcedId });
      },
      async softDelete(kind, rec) {
        calls.push({ op: "softDelete", kind, id: rec.sourcedId });
      },
    };
    return { writer, calls };
  }

  const base = normalizeSnapshot(loadSnapshot());
  const next: RosterSnapshot = {
    ...base,
    users: [...base.users, { ...base.users[0], sourcedId: "usr-new" }],
  };
  const diff = computeDiff(base, normalizeSnapshot(next));

  it("applies upserts (never hard-deletes) in dependency order with ample population", async () => {
    const { writer, calls } = fakeWriter();
    const res = await applyDiff(diff, writer, { population: 1000 });
    expect(res.applied).toBe(true);
    expect(res.paused).toBe(false);
    expect(calls.some((c) => c.op === "upsert" && c.id === "usr-new")).toBe(true);
    expect(calls.every((c) => c.op !== "hardDelete")).toBe(true);
  });

  it("pauses when the mutation cap is exceeded and writes nothing", async () => {
    const { writer, calls } = fakeWriter();
    const res = await applyDiff(diff, writer, { population: 1 }); // 1 mutation / 1 = 100% > 10%
    expect(res.paused).toBe(true);
    expect(res.applied).toBe(false);
    expect(calls).toHaveLength(0);
    expect(res.pauseReason).toMatch(/cap/i);
  });

  it("applies past the cap when overridden", async () => {
    const { writer } = fakeWriter();
    const res = await applyDiff(diff, writer, { population: 1, overrideCap: true });
    expect(res.applied).toBe(true);
  });

  it("dry-run computes counts without writing", async () => {
    const { writer, calls } = fakeWriter();
    const res = await applyDiff(diff, writer, { population: 1000, dryRun: true });
    expect(res.dryRun).toBe(true);
    expect(res.applied).toBe(false);
    expect(calls).toHaveLength(0);
    expect(res.counts.users.added).toBe(1);
  });

  it("exceedsCap is pure and matches applyDiff's decision", () => {
    expect(exceedsCap(diff, 1000).exceeds).toBe(false);
    expect(exceedsCap(diff, 1).exceeds).toBe(true);
  });
});

describe("reconcile — orphan detection with outage floor", () => {
  it("flags known ids missing from the incoming snapshot as orphans", () => {
    const incoming = emptySnapshot("oneroster");
    incoming.users = [{ ...loadSnapshot().users[0] }];
    const res = reconcile({
      known: {
        orgs: [],
        terms: [],
        courses: [],
        classes: [],
        users: [incoming.users[0].sourcedId, "orphan-1"],
        enrollments: [],
      },
      incoming,
    });
    expect(res.orphans.users).toEqual(["orphan-1"]);
    expect(res.totalOrphans).toBe(1);
  });

  it("refuses to orphan a whole population on an empty payload (suspected outage)", () => {
    const incoming = emptySnapshot("oneroster"); // users empty
    const res = reconcile({
      known: {
        orgs: [],
        terms: [],
        courses: [],
        classes: [],
        users: ["a", "b", "c"],
        enrollments: [],
      },
      incoming,
    });
    expect(res.suspectedOutage).toContain("users");
    expect(res.orphans.users).toEqual([]);
  });
});
