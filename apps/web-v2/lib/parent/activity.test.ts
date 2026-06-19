/**
 * Unit tests for the parent "Live updates" activity aggregation
 * (`lib/parent/activity.ts`).
 *
 * Covers the two pure cores — `buildActivityEvents` (real-data → sorted
 * events) and `paginate` (cursor windowing) — including: every event kind,
 * truthful empty/skip cases (no fabricated activity), newest-first ordering
 * with a stable tiebreaker, and cursor round-trips across pages.
 */
import { describe, it, expect } from "vitest";
import {
  buildActivityEvents,
  paginate,
  type ActivitySources,
  type ParentActivityEvent,
} from "./activity";
import type { LearnerCareTeam } from "@/lib/db/team-invites";

const SUBJECTS = [
  { id: "subj_math", slug: "math", name: "Mathematics", description: "", iconKey: "math" },
  { id: "subj_read", slug: "reading", name: "Reading", description: "", iconKey: "book" },
];

const EMPTY_TEAM: LearnerCareTeam = {
  teachers: [],
  caregivers: [],
  therapists: [],
  seats: {
    teacher: { used: 0, max: 1 },
    caregiver: { used: 0, max: 2 },
    therapist: { used: 0, max: 1 },
  },
};

function sources(over: Partial<ActivitySources> = {}): ActivitySources {
  return {
    learnerId: "lrn_1",
    learnerName: "Liam",
    runs: [],
    snapshots: [],
    engagement: null,
    iep: null,
    consents: [],
    careTeam: EMPTY_TEAM,
    subjects: SUBJECTS,
    ...over,
  };
}

// Minimal fixtures — the builder only reads a handful of fields, so cast the
// rest away rather than constructing full DB rows.
const run = (o: Record<string, unknown>) => o as never;
const snap = (o: Record<string, unknown>) => o as never;

describe("buildActivityEvents", () => {
  it("emits a completed-lesson event with the subject name", () => {
    const events = buildActivityEvents(
      sources({
        runs: [
          run({
            id: "r1",
            status: "completed",
            subjectId: "subj_read",
            completedAt: "2026-06-10T10:00:00.000Z",
          }),
        ],
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "lesson:r1",
      kind: "lesson",
      messageKey: "lesson_completed",
      params: { name: "Liam", subject: "Reading" },
      occurredAt: "2026-06-10T10:00:00.000Z",
      learnerId: "lrn_1",
    });
  });

  it("emits a tutor-started event for an in-progress run, capitalizing the persona", () => {
    const events = buildActivityEvents(
      sources({
        runs: [
          run({
            id: "r2",
            status: "in_progress",
            subjectId: "subj_math",
            tutorPersona: "nova",
            startedAt: "2026-06-10T09:00:00.000Z",
          }),
        ],
      }),
    );
    expect(events[0]).toMatchObject({
      kind: "tutor",
      params: { tutor: "Nova", subject: "Mathematics", name: "Liam" },
    });
  });

  it("skips runs with no usable timestamp (truthful — nothing happened yet)", () => {
    const events = buildActivityEvents(
      sources({
        runs: [
          run({ id: "r3", status: "completed", subjectId: "subj_math", completedAt: null }),
          run({ id: "r4", status: "ready", subjectId: "subj_math", startedAt: null }),
        ],
      }),
    );
    expect(events).toHaveLength(0);
  });

  it("emits a mastery event with a rounded percentage", () => {
    const events = buildActivityEvents(
      sources({
        snapshots: [
          snap({
            id: "m1",
            subjectId: "subj_read",
            averageScore: 0.826,
            capturedAt: "2026-06-09T10:00:00.000Z",
          }),
        ],
      }),
    );
    expect(events[0]).toMatchObject({
      kind: "mastery",
      messageKey: "mastery_updated",
      params: { subject: "Reading", pct: 83 },
    });
  });

  it("emits a streak event only at a real milestone (>= 2 days) with a session time", () => {
    const none = buildActivityEvents(
      sources({ engagement: { currentStreakDays: 1, lastSessionAt: "2026-06-10T10:00:00.000Z" } as never }),
    );
    expect(none).toHaveLength(0);

    const some = buildActivityEvents(
      sources({ engagement: { currentStreakDays: 5, lastSessionAt: "2026-06-10T10:00:00.000Z" } as never }),
    );
    expect(some[0]).toMatchObject({
      id: "streak:lrn_1:5",
      kind: "streak",
      params: { name: "Liam", days: 5 },
    });
  });

  it("emits one IEP event per accepted support, only once confirmed, capped", () => {
    const events = buildActivityEvents(
      sources({
        iep: {
          id: "iep1",
          confirmedAt: "2026-06-08T10:00:00.000Z",
          acceptedAccommodations: ["extended time", "frequent breaks", "read aloud", "fidget tool", "fifth"],
        } as never,
      }),
    );
    expect(events).toHaveLength(4); // capped at MAX_IEP_SUPPORTS
    expect(events.every((e) => e.kind === "iep")).toBe(true);
    expect(events[0].params.support).toBeTypeOf("string");

    const unconfirmed = buildActivityEvents(
      sources({ iep: { id: "iep2", confirmedAt: null, acceptedAccommodations: ["x"] } as never }),
    );
    expect(unconfirmed).toHaveLength(0);
  });

  it("emits consent grant/revoke events keyed by the latest action", () => {
    const events = buildActivityEvents(
      sources({
        consents: [
          {
            id: "c1",
            consentType: "ai_personalization",
            acceptedAt: "2026-06-01T10:00:00.000Z",
            revokedAt: null,
          } as never,
          {
            id: "c2",
            consentType: "school_roster_import",
            acceptedAt: "2026-06-02T10:00:00.000Z",
            revokedAt: "2026-06-05T10:00:00.000Z",
          } as never,
        ],
      }),
    );
    const granted = events.find((e) => e.id === "consent:c1:a");
    const revoked = events.find((e) => e.id === "consent:c2:r");
    expect(granted?.messageKey).toBe("consent_granted");
    expect(revoked?.messageKey).toBe("consent_revoked");
    expect(revoked?.occurredAt).toBe("2026-06-05T10:00:00.000Z");
  });

  it("emits a team-joined event only for ACCEPTED members", () => {
    const events = buildActivityEvents(
      sources({
        careTeam: {
          ...EMPTY_TEAM,
          teachers: [
            { id: "tm1", email: "ms.vega@school.org", status: "ACCEPTED", acceptedAt: "2026-06-07T10:00:00.000Z" } as never,
            { id: "tm2", email: "pending@school.org", status: "PENDING", acceptedAt: null } as never,
          ],
        },
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "team", params: { member: "ms.vega@school.org", role: "teacher" } });
  });

  it("orders newest-first with a deterministic id tiebreaker", () => {
    const events = buildActivityEvents(
      sources({
        iep: {
          id: "iep1",
          confirmedAt: "2026-06-08T10:00:00.000Z",
          acceptedAccommodations: ["a", "b"],
        } as never,
        runs: [
          run({ id: "r1", status: "completed", subjectId: "subj_math", completedAt: "2026-06-09T10:00:00.000Z" }),
        ],
      }),
    );
    // lesson (06-09) before iep (06-08); the two iep events share a timestamp
    // and fall back to id desc.
    expect(events.map((e) => e.id)).toEqual(["lesson:r1", "iep:iep1:1", "iep:iep1:0"]);
  });
});

describe("paginate", () => {
  const many: ParentActivityEvent[] = Array.from({ length: 10 }, (_, i) => ({
    id: `e${String(9 - i).padStart(2, "0")}`,
    kind: "lesson",
    messageKey: "lesson_completed",
    params: {},
    // Descending timestamps so the array is already newest-first.
    occurredAt: new Date(Date.UTC(2026, 5, 19, 0, 9 - i)).toISOString(),
    learnerId: "lrn_1",
  }));

  it("clamps the limit and returns a next cursor when more remain", () => {
    const page = paginate(many, { limit: 3 });
    expect(page.events).toHaveLength(3);
    expect(page.nextCursor).not.toBeNull();
  });

  it("walks every event across pages with no gaps or repeats", () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 5; i += 1) {
      const page: ReturnType<typeof paginate> = paginate(many, { cursor, limit: 4 });
      seen.push(...page.events.map((e) => e.id));
      cursor = page.nextCursor;
      if (!cursor) break;
    }
    expect(seen).toEqual(many.map((e) => e.id));
    expect(new Set(seen).size).toBe(many.length);
    expect(cursor).toBeNull();
  });

  it("treats a malformed cursor as the beginning", () => {
    const page = paginate(many, { cursor: "@@not-base64@@", limit: 5 });
    expect(page.events[0].id).toBe(many[0].id);
  });

  it("returns an empty page with no cursor for no events", () => {
    expect(paginate([], { limit: 5 })).toEqual({ events: [], nextCursor: null });
  });
});
