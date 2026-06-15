/**
 * Parent Recent Activity feed (Data-truth wiring).
 *
 * Aggregates REAL, already-persisted events into one time-sorted feed for the
 * parent's learner view:
 *   - lesson completions       (ParentLessonSummary, written by completeLessonRun)
 *   - caregiver observations   (caregiverObservations)
 *   - therapist session notes  (therapistSessionNotes — a pointer only, never
 *                               the clinical SOAP body)
 *   - pending recommendations  (recommendation-svc; degrades if unavailable)
 *
 * `mergeRecentActivity` is a pure function (sort + cap) so it is unit-testable.
 * `getRecentActivity` does the real repo reads and maps each row to a stable
 * `ActivityItem`. Nothing here invents an event: an empty feed means the
 * learner genuinely has no activity yet, and the UI shows an honest empty state.
 */
import type { ISODate } from "@/lib/db/types";
import {
  listParentLessonSummaries,
  listCaregiverObservations,
  listSessionNotes,
} from "@/lib/db/repos";
import { listRecommendationsForLearner } from "@/lib/bff/recommendation-svc";

export type ActivityKind = "lesson" | "observation" | "therapy_note" | "recommendation";

export type ActivityItem = {
  /** Globally-unique, kind-prefixed id (stable across renders). */
  id: string;
  kind: ActivityKind;
  /** When the event happened (ISO). The feed is sorted by this, newest first. */
  at: ISODate;
  /** i18n key under `parent.activity` for the one-line title. */
  titleKey: string;
  /** Interpolation params for the title (display-safe values only). */
  params?: Record<string, string | number>;
  /** Optional plain-text secondary line (already safe to render). */
  detail?: string | null;
  /** Optional in-app destination. */
  href?: string | null;
};

/** Pure: newest-first, stable tie-break by id, capped at `limit`. */
export function mergeRecentActivity(items: ActivityItem[], limit = 12): ActivityItem[] {
  return [...items]
    .filter((i) => typeof i.at === "string" && i.at.length > 0)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id.localeCompare(b.id)))
    .slice(0, Math.max(0, limit));
}

export async function getRecentActivity(input: {
  learnerId: string;
  tenantId: string;
  /** Used only for the cross-service recommendation read. */
  session: { userId: string; tenantId: string };
  subjectName: (subjectId: string) => string;
  limit?: number;
}): Promise<ActivityItem[]> {
  const { learnerId, tenantId } = input;
  const items: ActivityItem[] = [];

  // Lesson completions — the headline is the tutor's plain-language summary.
  for (const s of listParentLessonSummaries(learnerId, tenantId, { limit: 20 })) {
    items.push({
      id: `lesson:${s.id}`,
      kind: "lesson",
      at: s.createdAt,
      titleKey: "lesson_completed",
      params: { subject: input.subjectName(s.subjectId) },
      detail: s.headline,
      href: `/parent/learners/${learnerId}/summary`,
    });
  }

  // Caregiver observations — the behaviour note the caregiver logged.
  for (const o of listCaregiverObservations(learnerId, tenantId, 20)) {
    items.push({
      id: `obs:${o.id}`,
      kind: "observation",
      at: o.observedAt,
      titleKey: "observation_added",
      detail: o.behaviour,
      href: null,
    });
  }

  // Therapist session notes — a pointer only. The clinical SOAP body stays in
  // the therapist surface; the parent feed shows that a note exists + length.
  for (const n of listSessionNotes(learnerId, tenantId)) {
    items.push({
      id: `note:${n.id}`,
      kind: "therapy_note",
      at: n.sessionDate,
      titleKey: "therapy_note_added",
      params: { minutes: n.durationMinutes },
      href: null,
    });
  }

  // Pending recommendations — cross-service; degrade gracefully so a down
  // recommendation-svc never breaks the parent page (the feed stays real,
  // just without this source).
  try {
    const recs = await listRecommendationsForLearner(input.session, learnerId);
    for (const r of recs.pending) {
      items.push({
        id: `rec:${r.id}`,
        kind: "recommendation",
        at: r.createdAt,
        titleKey: "recommendation_pending",
        params: { title: r.title },
        href: `/parent/learners/${learnerId}`,
      });
    }
  } catch {
    // recommendation-svc unavailable — omit this source only.
  }

  return mergeRecentActivity(items, input.limit ?? 12);
}
