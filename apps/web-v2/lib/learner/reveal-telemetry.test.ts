/**
 * Sprint C-14 — reveal instrumentation: the event taxonomy round-trips through
 * the audit action namespace, and the pure funnel reducer computes
 * completion→approval conversion + time-to-approve from a flat event stream.
 *
 * This is the "test/admin query proving the funnel is computable" the DoD asks
 * for (a dashboard is out of scope).
 */
import { describe, expect, it } from "vitest";
import {
  REVEAL_EVENTS,
  computeRevealFunnel,
  parseRevealAction,
  revealAction,
  revealEventsFromAuditLogs,
  type RevealAuditRow,
  type RevealEvent,
} from "./reveal-telemetry";

describe("reveal action namespace", () => {
  it("round-trips every event name through the audit action string", () => {
    for (const name of REVEAL_EVENTS) {
      const action = revealAction(name);
      expect(action).toBe(`reveal.${name}`);
      expect(parseRevealAction(action)).toBe(name);
    }
  });

  it("ignores non-reveal and unknown actions", () => {
    expect(parseRevealAction("brain_profile.approve")).toBeNull();
    expect(parseRevealAction("reveal.not_a_real_event")).toBeNull();
  });
});

describe("computeRevealFunnel", () => {
  it("computes conversion and time-to-approve for one complete walk", () => {
    // One learner: started 10:00:00, ceremony 10:02:00, approved 10:02:30,
    // shared 10:03:00 → 150s to approve, 100% conversion.
    const events: RevealEvent[] = [
      { name: "reveal_started", learnerId: "l1", occurredAt: "2026-06-13T10:00:00.000Z" },
      { name: "screen_advanced", learnerId: "l1", occurredAt: "2026-06-13T10:00:20.000Z", screen: 2 },
      { name: "screen_advanced", learnerId: "l1", occurredAt: "2026-06-13T10:01:00.000Z", screen: 3 },
      { name: "ceremony_reached", learnerId: "l1", occurredAt: "2026-06-13T10:02:00.000Z" },
      { name: "approved", learnerId: "l1", occurredAt: "2026-06-13T10:02:30.000Z" },
      { name: "share_artifact_created", learnerId: "l1", occurredAt: "2026-06-13T10:03:00.000Z" },
    ];
    const f = computeRevealFunnel(events);
    expect(f.started).toBe(1);
    expect(f.ceremonyReached).toBe(1);
    expect(f.approved).toBe(1);
    expect(f.shared).toBe(1);
    expect(f.conversion).toBe(1);
    expect(f.medianTimeToApproveSeconds).toBe(150);
    expect(f.timeToApproveSeconds).toEqual([{ learnerId: "l1", seconds: 150 }]);
  });

  it("counts an amendment as an approval and computes conversion across learners", () => {
    const events: RevealEvent[] = [
      // l1: started, approved (60s)
      { name: "reveal_started", learnerId: "l1", occurredAt: "2026-06-13T10:00:00.000Z" },
      { name: "approved", learnerId: "l1", occurredAt: "2026-06-13T10:01:00.000Z" },
      // l2: started, amended (120s) — amended counts as approved
      { name: "reveal_started", learnerId: "l2", occurredAt: "2026-06-13T10:00:00.000Z" },
      { name: "amended", learnerId: "l2", occurredAt: "2026-06-13T10:02:00.000Z" },
      // l3: started, never approved (a drop-off)
      { name: "reveal_started", learnerId: "l3", occurredAt: "2026-06-13T10:00:00.000Z" },
    ];
    const f = computeRevealFunnel(events);
    expect(f.started).toBe(3);
    expect(f.approved).toBe(2);
    expect(f.conversion).toBeCloseTo(2 / 3, 5);
    // Median of [60, 120] → rounds to 90.
    expect(f.medianTimeToApproveSeconds).toBe(90);
  });

  it("uses the earliest start and earliest approval on replay/re-entry", () => {
    const events: RevealEvent[] = [
      { name: "reveal_started", learnerId: "l1", occurredAt: "2026-06-13T10:05:00.000Z" },
      { name: "reveal_started", learnerId: "l1", occurredAt: "2026-06-13T10:00:00.000Z" }, // replay earlier
      { name: "approved", learnerId: "l1", occurredAt: "2026-06-13T10:10:00.000Z" },
      { name: "approved", learnerId: "l1", occurredAt: "2026-06-13T10:08:00.000Z" }, // earliest wins
    ];
    const f = computeRevealFunnel(events);
    // Earliest start 10:00, earliest approval 10:08 → 480s.
    expect(f.timeToApproveSeconds).toEqual([{ learnerId: "l1", seconds: 480 }]);
  });

  it("is empty/zero with no events and ignores malformed timestamps", () => {
    expect(computeRevealFunnel([])).toMatchObject({
      started: 0,
      approved: 0,
      conversion: 0,
      medianTimeToApproveSeconds: null,
    });
    const f = computeRevealFunnel([
      { name: "reveal_started", learnerId: "l1", occurredAt: "not-a-date" },
    ]);
    expect(f.started).toBe(0);
  });

  it("is computable end-to-end from reveal.* audit rows (the conversion read-path)", () => {
    // What an admin query yields: append-only audit rows under reveal.* — the
    // exact shape `audit()` writes. The read-path normalises + the reducer
    // computes conversion + time-to-approve with no dashboard.
    const rows: RevealAuditRow[] = [
      { action: "reveal.reveal_started", learnerId: "l1", occurredAt: "2026-06-13T09:00:00.000Z", userId: "p1" },
      { action: "reveal.screen_advanced", learnerId: "l1", occurredAt: "2026-06-13T09:00:30.000Z", userId: "p1", metadata: { screen: 3 } },
      { action: "reveal.ceremony_reached", learnerId: "l1", occurredAt: "2026-06-13T09:02:00.000Z", userId: "p1" },
      { action: "reveal.approved", learnerId: "l1", occurredAt: "2026-06-13T09:03:00.000Z", userId: "p1" },
      { action: "reveal.share_artifact_created", learnerId: "l1", occurredAt: "2026-06-13T09:04:00.000Z", userId: "p1" },
      // A non-reveal audit row is ignored by the read-path.
      { action: "brain_profile.approve", learnerId: "l1", occurredAt: "2026-06-13T09:03:00.000Z" },
      // A row without a learnerId is dropped.
      { action: "reveal.reveal_started", learnerId: null, occurredAt: "2026-06-13T09:00:00.000Z" },
    ];
    const events = revealEventsFromAuditLogs(rows);
    // Five real reveal events (the two junk rows dropped), screen carried through.
    expect(events).toHaveLength(5);
    expect(events.find((e) => e.name === "screen_advanced")?.screen).toBe(3);

    const f = computeRevealFunnel(events);
    expect(f.started).toBe(1);
    expect(f.ceremonyReached).toBe(1);
    expect(f.approved).toBe(1);
    expect(f.shared).toBe(1);
    expect(f.conversion).toBe(1);
    // 09:00:00 → 09:03:00 = 180s to approve.
    expect(f.medianTimeToApproveSeconds).toBe(180);
  });

  it("excludes a learner whose approval precedes their start from the duration", () => {
    const events: RevealEvent[] = [
      { name: "reveal_started", learnerId: "l1", occurredAt: "2026-06-13T10:05:00.000Z" },
      { name: "approved", learnerId: "l1", occurredAt: "2026-06-13T10:00:00.000Z" },
    ];
    const f = computeRevealFunnel(events);
    expect(f.approved).toBe(1); // still counts as approved
    expect(f.timeToApproveSeconds).toEqual([]); // but no (negative) duration
    expect(f.medianTimeToApproveSeconds).toBeNull();
  });
});
