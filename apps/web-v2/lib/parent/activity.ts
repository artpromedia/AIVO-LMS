/**
 * Parent "Live updates" activity feed — backend aggregation.
 *
 * The parent/caregiver home design (`ParentApp.dc.html` → "Live updates" card)
 * shows a real-time stream of what a learner has been doing: lessons finished,
 * a tutor starting a session, mastery moving, a streak milestone, an IEP
 * support being applied, consent changes, and care-team members joining.
 *
 * This module turns the platform's existing, truthful repo data into a single,
 * cursor-paged, newest-first stream. Per the home view's truthful-data
 * contract, **every** event is derived from a real stored value — there is no
 * fabricated activity. When a learner has done nothing yet, the feed is simply
 * empty and the card renders its honest empty state.
 *
 * Shape mirrors `BACKEND-WIRING.md`: the BFF envelope is
 * `{ id, kind, text, occurredAt, learnerId }`. Here we keep the message as a
 * structured `{ messageKey, params }` pair so the BFF route can localize it
 * with `next-intl` (the i18n plan keys every visible string); the route then
 * resolves `text` per request locale.
 *
 * Designed to upgrade cleanly: today the home card polls the BFF endpoint via
 * `lib/use-live-refresh.ts`; when the SSE/WebSocket fan-out lands the same
 * envelope flows through unchanged.
 */
import {
  getIEPForLearner,
  getLearner,
  getLearnerEngagement,
  listConsentsForLearner,
  listLessonRunsForLearner,
  listMasterySnapshots,
  listSubjects,
} from "@/lib/db/repos";
import { getCareTeam, type LearnerCareTeam, type TeamRole } from "@/lib/db/team-invites";
import type {
  ConsentRecord,
  IEPDocument,
  LearnerEngagement,
  LessonRun,
  MasterySnapshot,
  Subject,
} from "@/lib/db/types";

export type ParentActivityKind =
  | "lesson"
  | "tutor"
  | "mastery"
  | "streak"
  | "iep"
  | "consent"
  | "team";

/**
 * A single activity event, pre-localization. `messageKey` is a key under the
 * `parent.activity` i18n namespace; `params` are its interpolation values.
 */
export interface ParentActivityEvent {
  id: string;
  kind: ParentActivityKind;
  messageKey: string;
  params: Record<string, string | number>;
  /** ISO-8601 timestamp the underlying thing actually happened. */
  occurredAt: string;
  learnerId: string;
}

export interface ParentActivityPage {
  events: ParentActivityEvent[];
  /** Opaque cursor for the next (older) page, or null when exhausted. */
  nextCursor: string | null;
}

/** Everything `buildActivityEvents` needs — passed in so the builder stays pure. */
export interface ActivitySources {
  learnerId: string;
  /** Learner's preferred/first name, for human-readable copy. */
  learnerName: string;
  runs: LessonRun[];
  snapshots: MasterySnapshot[];
  engagement: LearnerEngagement | null;
  iep: IEPDocument | null;
  consents: ConsentRecord[];
  careTeam: LearnerCareTeam;
  subjects: Subject[];
}

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 50;
/** Cap per-IEP support fan-out so one confirmation can't flood the stream. */
const MAX_IEP_SUPPORTS = 4;

function subjectLabel(subjects: Subject[], subjectId: string): string {
  return subjects.find((s) => s.id === subjectId)?.name ?? subjectId;
}

/** Display name for an AI tutor persona (e.g. "nova" → "Nova"). */
function tutorLabel(persona: string): string {
  if (!persona) return "AIVO Tutor";
  return persona.charAt(0).toUpperCase() + persona.slice(1);
}

/** Member's human label: a resolved display name isn't stored, so use email. */
function memberLabel(email: string): string {
  return email;
}

type TeamBucket = "teachers" | "caregivers" | "therapists";
const TEAM_ROLES: ReadonlyArray<readonly [TeamBucket, TeamRole]> = [
  ["teachers", "teacher"],
  ["caregivers", "caregiver"],
  ["therapists", "therapist"],
];

/**
 * Pure: fold the learner's real data into a sorted (newest-first) event list.
 * No I/O — every input is already-fetched, so this is exhaustively unit-tested.
 */
export function buildActivityEvents(src: ActivitySources): ParentActivityEvent[] {
  const { learnerId, learnerName, subjects } = src;
  const events: ParentActivityEvent[] = [];
  const push = (
    e: Omit<ParentActivityEvent, "learnerId" | "occurredAt"> & { occurredAt: string | null },
  ): void => {
    if (!e.occurredAt) return;
    events.push({ ...e, occurredAt: e.occurredAt, learnerId });
  };

  for (const run of src.runs) {
    if (run.status === "completed" && run.completedAt) {
      push({
        id: `lesson:${run.id}`,
        kind: "lesson",
        messageKey: "lesson_completed",
        params: { name: learnerName, subject: subjectLabel(subjects, run.subjectId) },
        occurredAt: run.completedAt,
      });
    } else if ((run.status === "in_progress" || run.status === "ready") && run.startedAt) {
      push({
        id: `tutor:${run.id}`,
        kind: "tutor",
        messageKey: "tutor_started",
        params: {
          tutor: tutorLabel(run.tutorPersona),
          subject: subjectLabel(subjects, run.subjectId),
          name: learnerName,
        },
        occurredAt: run.startedAt,
      });
    }
  }

  for (const snap of src.snapshots) {
    push({
      id: `mastery:${snap.id}`,
      kind: "mastery",
      messageKey: "mastery_updated",
      params: {
        subject: subjectLabel(subjects, snap.subjectId),
        pct: Math.round(snap.averageScore * 100),
      },
      occurredAt: snap.capturedAt,
    });
  }

  const streak = src.engagement?.currentStreakDays ?? 0;
  if (streak >= 2 && src.engagement?.lastSessionAt) {
    push({
      id: `streak:${learnerId}:${streak}`,
      kind: "streak",
      messageKey: "streak_reached",
      params: { name: learnerName, days: streak },
      occurredAt: src.engagement.lastSessionAt,
    });
  }

  if (src.iep?.confirmedAt && src.iep.acceptedAccommodations?.length) {
    src.iep.acceptedAccommodations.slice(0, MAX_IEP_SUPPORTS).forEach((support, i) => {
      push({
        id: `iep:${src.iep!.id}:${i}`,
        kind: "iep",
        messageKey: "iep_applied",
        params: { support },
        occurredAt: src.iep!.confirmedAt,
      });
    });
  }

  for (const rec of src.consents) {
    const revoked = !!rec.revokedAt;
    push({
      id: `consent:${rec.id}:${revoked ? "r" : "a"}`,
      kind: "consent",
      messageKey: revoked ? "consent_revoked" : "consent_granted",
      params: { type: rec.consentType },
      occurredAt: revoked ? rec.revokedAt : rec.acceptedAt,
    });
  }

  for (const [bucket, role] of TEAM_ROLES) {
    for (const m of src.careTeam[bucket]) {
      if (m.status === "ACCEPTED" && m.acceptedAt) {
        push({
          id: `team:${m.id}`,
          kind: "team",
          messageKey: "team_joined",
          params: { member: memberLabel(m.email), name: learnerName, role },
          occurredAt: m.acceptedAt,
        });
      }
    }
  }

  // Newest first; id as a stable tiebreaker so paging is deterministic when
  // several events share a timestamp (e.g. multiple IEP supports confirmed at
  // once).
  events.sort((a, b) => {
    if (a.occurredAt !== b.occurredAt) return a.occurredAt < b.occurredAt ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
  return events;
}

function encodeCursor(e: ParentActivityEvent): string {
  return Buffer.from(`${e.occurredAt}::${e.id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string): { occurredAt: string; id: string } | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const sep = raw.indexOf("::");
    if (sep < 0) return null;
    return { occurredAt: raw.slice(0, sep), id: raw.slice(sep + 2) };
  } catch {
    return null;
  }
}

/** True when `e` sorts strictly *after* the cursor position (i.e. is older). */
function isAfterCursor(e: ParentActivityEvent, cur: { occurredAt: string; id: string }): boolean {
  if (e.occurredAt !== cur.occurredAt) return e.occurredAt < cur.occurredAt;
  return e.id < cur.id;
}

/**
 * Pure: slice a sorted event list into one cursor page. Clamps `limit` to a
 * sane 1..50 and returns `nextCursor` only when more events remain.
 */
export function paginate(
  events: ParentActivityEvent[],
  opts: { cursor?: string | null; limit?: number } = {},
): ParentActivityPage {
  const limit = Math.min(Math.max(Math.floor(opts.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
  const cur = opts.cursor ? decodeCursor(opts.cursor) : null;
  const window = cur ? events.filter((e) => isAfterCursor(e, cur)) : events;
  const page = window.slice(0, limit);
  const hasMore = window.length > limit;
  return {
    events: page,
    nextCursor: hasMore && page.length > 0 ? encodeCursor(page[page.length - 1]) : null,
  };
}

/**
 * Gather one learner's recent activity from real repos and return a cursor
 * page. Caller is responsible for access control (the BFF route enforces
 * `requireLearnerScope`); `parentUserId` scopes the consent read.
 */
export async function listLearnerActivity(
  learnerId: string,
  tenantId: string,
  opts: { parentUserId: string; cursor?: string | null; limit?: number },
): Promise<ParentActivityPage> {
  const [learner, runs, snapshots, engagement, iep, consents, careTeam, subjects] =
    await Promise.all([
      getLearner(learnerId, tenantId),
      listLessonRunsForLearner(learnerId, tenantId),
      listMasterySnapshots(learnerId, tenantId),
      getLearnerEngagement(learnerId, tenantId),
      getIEPForLearner(learnerId, tenantId),
      listConsentsForLearner(opts.parentUserId, learnerId, tenantId),
      getCareTeam(learnerId, tenantId),
      listSubjects(),
    ]);

  const events = buildActivityEvents({
    learnerId,
    learnerName: learner?.firstName || learner?.displayName?.split(" ")[0] || "Your learner",
    runs,
    snapshots,
    engagement,
    iep,
    consents,
    careTeam,
    subjects,
  });

  return paginate(events, { cursor: opts.cursor, limit: opts.limit });
}
