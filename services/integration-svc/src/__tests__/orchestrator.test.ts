import { describe, it, expect } from "vitest";
import { emptySnapshot, type RosterSnapshot } from "../types/canonical.js";
import { RecordingRosterWriter } from "../pipeline/load.js";
import { runSync, InMemoryCheckpointStore } from "../pipeline/orchestrator.js";

function snapshot(): RosterSnapshot {
  const s = emptySnapshot("oneroster");
  s.orgs = [{ provider: "oneroster", sourcedId: "o1", status: "active", name: "D", type: "district" }];
  s.terms = [{ provider: "oneroster", sourcedId: "t1", status: "active", title: "T", type: "term" }];
  s.courses = [{ provider: "oneroster", sourcedId: "c1", status: "active", title: "C" }];
  s.classes = [{ provider: "oneroster", sourcedId: "cl1", status: "active", title: "Cl", type: "scheduled", schoolSourcedId: "o1", termSourcedIds: ["t1"] }];
  s.users = [{ provider: "oneroster", sourcedId: "u1", status: "active", enabled: true, givenName: "A", familyName: "B", roles: ["student"], primaryRole: "student", orgSourcedIds: ["o1"] }];
  s.enrollments = [{ provider: "oneroster", sourcedId: "e1", status: "active", classSourcedId: "cl1", schoolSourcedId: "o1", userSourcedId: "u1", role: "student" }];
  return s;
}

/** Writer that throws after `failAfter` successful ops (simulated crash). */
class CrashingWriter extends RecordingRosterWriter {
  constructor(private failAfter: number) {
    super();
  }
  override async upsert(kind: Parameters<RecordingRosterWriter["upsert"]>[0], rec: { sourcedId: string }) {
    if (this.ops.length >= this.failAfter) throw new Error("worker killed");
    await super.upsert(kind, rec);
  }
}

describe("runSync — checkpoint / resume (chaos safety)", () => {
  it("resumes from the last completed kind with no duplicate writes", async () => {
    const checkpoint = new InMemoryCheckpointStore();
    const next = snapshot();
    const empty = emptySnapshot("oneroster");

    // First attempt crashes partway (after orgs + terms are written, while in
    // courses/classes/users — 1 op each in this fixture, so fail after 2).
    const crasher = new CrashingWriter(2);
    await expect(
      runSync({ runId: "run1", prev: empty, next, writer: crasher, checkpoint, population: 1000 }),
    ).rejects.toThrow(/worker killed/);

    // Checkpoint recorded the kinds that fully completed before the crash.
    const cp = await checkpoint.load("run1");
    expect(cp?.completedKinds).toEqual(["orgs", "terms"]);
    expect(crasher.ops.map((o) => o.kind)).toEqual(["orgs", "terms"]);

    // Resume with a fresh writer: it must NOT rewrite orgs/terms.
    const resume = new RecordingRosterWriter();
    const res = await runSync({ runId: "run1", prev: empty, next, writer: resume, checkpoint, population: 1000 });
    expect(res.applied).toBe(true);
    expect(res.resumedFrom).toEqual(["orgs", "terms"]);
    const kinds = resume.ops.map((o) => o.kind);
    expect(kinds).not.toContain("orgs");
    expect(kinds).not.toContain("terms");
    expect(kinds).toEqual(["courses", "classes", "users", "enrollments"]);
  });

  it("pauses over the mutation cap and writes nothing", async () => {
    const writer = new RecordingRosterWriter();
    const res = await runSync({
      runId: "run2",
      prev: emptySnapshot("oneroster"),
      next: snapshot(),
      writer,
      checkpoint: new InMemoryCheckpointStore(),
      population: 1, // 6 mutations / 1 = 600% > 10%
    });
    expect(res.paused).toBe(true);
    expect(writer.ops).toHaveLength(0);
  });

  it("a fully-completed run resumes to a no-op", async () => {
    const checkpoint = new InMemoryCheckpointStore();
    const next = snapshot();
    const w1 = new RecordingRosterWriter();
    await runSync({ runId: "run3", prev: emptySnapshot("oneroster"), next, writer: w1, checkpoint, population: 1000 });
    const w2 = new RecordingRosterWriter();
    const res = await runSync({ runId: "run3", prev: emptySnapshot("oneroster"), next, writer: w2, checkpoint, population: 1000 });
    expect(w2.ops).toHaveLength(0); // everything already checkpointed
    expect(res.appliedKinds).toEqual([]);
  });
});
