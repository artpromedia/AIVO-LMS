/**
 * Sprint C-16 — the DoD metric: repeat-contribution rate.
 *
 * The pure reducer computes "of contributors whose input was acknowledged, the
 * share who contribute again within 60 days". This is the seeded test proving
 * the math (a dashboard is out of scope).
 */
import { describe, expect, it } from "vitest";
import {
  CONTRIBUTION_EVENTS,
  computeContributionRetention,
  contributionAction,
  contributionEventsFromAuditLogs,
  parseContributionAction,
  type ContributionAuditRow,
  type ContributionEvent,
} from "./contribution-retention";

describe("contribution action namespace", () => {
  it("round-trips every event name through the audit action string", () => {
    for (const name of CONTRIBUTION_EVENTS) {
      const action = contributionAction(name);
      expect(action).toBe(`contribution.${name}`);
      expect(parseContributionAction(action)).toBe(name);
    }
  });

  it("ignores non-contribution and unknown actions", () => {
    expect(parseContributionAction("reveal.approved")).toBeNull();
    expect(parseContributionAction("contribution.exploded")).toBeNull();
  });
});

describe("contributionEventsFromAuditLogs", () => {
  it("normalises rows and drops those without a contributorKey", () => {
    const rows: ContributionAuditRow[] = [
      {
        action: "contribution.acknowledged",
        occurredAt: "2026-01-01T00:00:00.000Z",
        metadata: { contributorKey: "t@x.io", role: "teacher" },
      },
      // dropped — no contributorKey
      { action: "contribution.submitted", occurredAt: "2026-01-02T00:00:00.000Z", metadata: {} },
      // dropped — not a contribution action
      { action: "teacher_assessment.submit", occurredAt: "2026-01-03T00:00:00.000Z", metadata: {} },
    ];
    const events = contributionEventsFromAuditLogs(rows);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ name: "acknowledged", contributorKey: "t@x.io", role: "teacher" });
  });
});

/** Build an event helper. */
function ev(
  name: ContributionEvent["name"],
  key: string,
  role: string,
  occurredAt: string,
): ContributionEvent {
  return { name, contributorKey: key, role, occurredAt };
}

const ACK = "2026-03-01T00:00:00.000Z";
const within = "2026-04-01T00:00:00.000Z"; // 31 days after ack
const beyond = "2026-05-15T00:00:00.000Z"; // 75 days after ack
const before = "2026-02-01T00:00:00.000Z"; // 28 days BEFORE ack

describe("computeContributionRetention — the seeded math", () => {
  it("counts a contributor who contributed again within the window as a repeat", () => {
    const events = [
      ev("acknowledged", "a@x.io", "teacher", ACK),
      ev("submitted", "a@x.io", "teacher", within),
    ];
    const r = computeContributionRetention(events, 60);
    expect(r.acknowledgedContributors).toBe(1);
    expect(r.repeatContributors).toBe(1);
    expect(r.repeatRate).toBe(1);
  });

  it("does NOT count a repeat outside the window", () => {
    const events = [
      ev("acknowledged", "b@x.io", "therapist", ACK),
      ev("submitted", "b@x.io", "therapist", beyond),
    ];
    const r = computeContributionRetention(events, 60);
    expect(r.acknowledgedContributors).toBe(1);
    expect(r.repeatContributors).toBe(0);
    expect(r.repeatRate).toBe(0);
  });

  it("does NOT count a submission that PREDATES the acknowledgement (the folded one)", () => {
    // The submission that got folded happens before approval — never a "repeat".
    const events = [
      ev("submitted", "c@x.io", "caregiver", before),
      ev("acknowledged", "c@x.io", "caregiver", ACK),
    ];
    const r = computeContributionRetention(events, 60);
    expect(r.acknowledgedContributors).toBe(1);
    expect(r.repeatContributors).toBe(0);
  });

  it("computes a fractional rate across a cohort + per-role breakdown", () => {
    const events = [
      // teacher A: acknowledged + repeated within window → repeat
      ev("acknowledged", "a@x.io", "teacher", ACK),
      ev("submitted", "a@x.io", "teacher", within),
      // teacher B: acknowledged, no repeat → not a repeat
      ev("acknowledged", "b@x.io", "teacher", ACK),
      // therapist C: acknowledged + repeated → repeat
      ev("acknowledged", "c@x.io", "therapist", ACK),
      ev("submitted", "c@x.io", "therapist", within),
      // a submission from a NEVER-acknowledged contributor → ignored entirely
      ev("submitted", "d@x.io", "caregiver", within),
    ];
    const r = computeContributionRetention(events, 60);
    // 3 acknowledged (a, b, c); 2 repeated (a, c).
    expect(r.acknowledgedContributors).toBe(3);
    expect(r.repeatContributors).toBe(2);
    expect(r.repeatRate).toBeCloseTo(2 / 3, 5);
    // Per-role: teacher 1/2, therapist 1/1, caregiver absent (never acknowledged).
    expect(r.byRole.teacher).toEqual({ acknowledged: 2, repeat: 1, rate: 0.5 });
    expect(r.byRole.therapist).toEqual({ acknowledged: 1, repeat: 1, rate: 1 });
    expect(r.byRole.caregiver).toBeUndefined();
  });

  it("anchors on the FIRST acknowledgement so a re-acknowledgement can't shift the window", () => {
    const reAck = "2026-04-20T00:00:00.000Z"; // a later (2nd) ack
    const events = [
      ev("acknowledged", "e@x.io", "teacher", ACK), // first ack (anchor)
      ev("acknowledged", "e@x.io", "teacher", reAck), // re-ack — ignored as anchor
      ev("submitted", "e@x.io", "teacher", beyond), // 75d after FIRST ack → out
    ];
    const r = computeContributionRetention(events, 60);
    expect(r.repeatContributors).toBe(0);
  });

  it("returns a zero rate (not NaN) when nobody was acknowledged", () => {
    const r = computeContributionRetention([ev("submitted", "z@x.io", "teacher", within)], 60);
    expect(r.acknowledgedContributors).toBe(0);
    expect(r.repeatRate).toBe(0);
  });
});
