/**
 * Sprint A4 — Teacher home aggregation.
 *
 * Builds the teacher-home overview entirely from real persisted rows
 * (classrooms, enrollments, mastery maps + snapshots, lesson runs,
 * assignments, calendar events). No mock data: every number on the page
 * is computed here from the store, and each source read is wrapped so a
 * single failing dependency degrades to an empty section instead of
 * throwing the whole page (settle/degrade per the sprint constitution).
 */
import {
  getMasteryMap,
  getSubjectById,
  listCalendarEventsForTeacher,
  listClassrooms,
  listEnrollments,
  listMasterySnapshots,
  listSkills,
  listLearnersForTeacher,
  listTeacherAssignments,
  recentAuditLogs,
} from "@/lib/db/repos";
import type { AuditLog, CalendarEvent, LearnerProfile, Skill } from "@/lib/db/types";

/** On-track / at-risk thresholds on the 0..1 mean mastery scale. */
const ON_TRACK_MIN = 0.6;
const AT_RISK_MAX = 0.4;

export type AttentionStatus = "needs_support" | "at_risk";

export type TodayClass = {
  id: string;
  name: string;
  scheduleLabel: string | null;
  learnerCount: number;
  onTrackPct: number;
  focusArea: string | null;
  todayTopic: string | null;
  subjectName: string | null;
};

export type AttentionRow = {
  learnerId: string;
  displayName: string;
  avatarName: string;
  gradeLabel: string;
  strugglingWith: string;
  status: AttentionStatus;
  lastActivityLabel: string;
  suggestedAction: string;
  suggestedHref: string;
};

export type RecentActivityItem = {
  id: string;
  text: string;
  timeLabel: string;
  tone: "success" | "primary" | "info";
};

export type GlanceKpis = {
  classes: number;
  learners: number;
  assignmentsDue: number;
  assignmentsGrading: number;
  needSupport: number;
  atRisk: number;
  classAvgPct: number;
  classAvgDeltaPct: number | null;
};

export type UpcomingItem = {
  id: string;
  dateLabel: string;
  monthLabel: string;
  title: string;
  subtitle: string | null;
  type: CalendarEvent["type"];
};

export type TeacherHomeOverview = {
  classes: TodayClass[];
  attention: AttentionRow[];
  recentActivity: RecentActivityItem[];
  glance: GlanceKpis;
  upcoming: UpcomingItem[];
};

/** Run a producer, returning `fallback` (and swallowing) on any error. */
async function settle<T>(producer: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await producer();
  } catch {
    return fallback;
  }
}

const GRADE_LABELS: Record<string, string> = {
  preK: "Pre-K",
  K: "Kindergarten",
  "1-2": "Grades 1–2",
  "3-5": "Grades 3–5",
  "6-8": "Grades 6–8",
  "9-12": "Grades 9–12",
  post_secondary: "Post-secondary",
};

function gradeLabel(band: string | null): string {
  return band ? (GRADE_LABELS[band] ?? band) : "Unassigned";
}

function relativeDayLabel(iso: string | null): string {
  if (!iso) return "No recent activity";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "No recent activity";
  const days = Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Mean 0..1 mastery score for a learner across their evaluated skills. */
async function learnerMastery(
  learnerId: string,
  tenantId: string,
): Promise<{ mean: number | null; weakest: Skill["id"] | null }> {
  return settle(
    async () => {
      const { skillMasteries } = await getMasteryMap(learnerId, tenantId);
      if (skillMasteries.length === 0) return { mean: null, weakest: null };
      const mean =
        skillMasteries.reduce((s, m) => s + m.score, 0) / skillMasteries.length;
      const weakest = skillMasteries
        .slice()
        .sort((a, b) => a.score - b.score)[0];
      return { mean, weakest: weakest?.skillId ?? null };
    },
    { mean: null, weakest: null },
  );
}

export async function getTeacherHomeOverview(
  teacherUserId: string,
  tenantId: string,
): Promise<TeacherHomeOverview> {
  // --- Roster + skill/subject lookups (shared across sections) ----------
  const roster = await settle(
    () => listLearnersForTeacher(teacherUserId, tenantId),
    [] as LearnerProfile[],
  );
  const rosterById = new Map(roster.map((l) => [l.id, l]));
  const skills = await settle(() => listSkills(), [] as Skill[]);
  const skillNameById = new Map(skills.map((s) => [s.id, s.name]));

  // Mean mastery per learner, computed once and reused everywhere.
  const masteryByLearner = new Map<string, { mean: number | null; weakest: string | null }>();
  await Promise.all(
    roster.map(async (l) => {
      masteryByLearner.set(l.id, await learnerMastery(l.id, tenantId));
    }),
  );

  // Recent learner activity, sourced from the tenant audit trail. Newest
  // first; we keep only entries tied to a roster learner.
  const auditLogs = await settle(() => recentAuditLogs(tenantId, 60), [] as AuditLog[]);
  const learnerActivity = auditLogs
    .filter((a) => a.learnerId && rosterById.has(a.learnerId))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const lastActivityByLearner = new Map<string, string>();
  for (const a of learnerActivity) {
    if (a.learnerId && !lastActivityByLearner.has(a.learnerId)) {
      lastActivityByLearner.set(a.learnerId, a.occurredAt);
    }
  }

  // --- Today's classes --------------------------------------------------
  const classrooms = await settle(
    () => listClassrooms({ tenantId, teacherUserId }),
    [],
  );
  const classes: TodayClass[] = await Promise.all(
    classrooms.map(async (c) => {
      const enrollments = await settle(() => listEnrollments(c.id), []);
      const learnerIds = enrollments
        .filter((e) => e.role === "learner")
        .map((e) => e.subjectId);
      const means = learnerIds
        .map((id) => masteryByLearner.get(id)?.mean)
        .filter((m): m is number => typeof m === "number");
      const onTrack = means.filter((m) => m >= ON_TRACK_MIN).length;
      const onTrackPct = means.length > 0 ? Math.round((onTrack / means.length) * 100) : 0;
      const subjectName = c.subjectId
        ? (await settle(() => getSubjectById(c.subjectId!), null))?.name ?? null
        : null;
      const scheduleLabel = c.schedule
        ? `${c.schedule.startTime} – ${c.schedule.endTime}`
        : null;
      return {
        id: c.id,
        name: c.name,
        scheduleLabel,
        learnerCount: learnerIds.length,
        onTrackPct,
        focusArea: c.focusArea ?? null,
        todayTopic: c.todayTopic ?? null,
        subjectName,
      };
    }),
  );

  // --- Learners needing attention --------------------------------------
  const attentionCandidates = roster
    .map((l) => {
      const m = masteryByLearner.get(l.id);
      return { learner: l, mean: m?.mean ?? null, weakest: m?.weakest ?? null };
    })
    .filter((r) => r.mean !== null && r.mean < ON_TRACK_MIN)
    .sort((a, b) => (a.mean ?? 1) - (b.mean ?? 1));

  const attention: AttentionRow[] = attentionCandidates.slice(0, 6).map((r) => {
    const status: AttentionStatus =
      (r.mean ?? 1) < AT_RISK_MAX ? "at_risk" : "needs_support";
    const skillName = r.weakest ? skillNameById.get(r.weakest) ?? "core skills" : "core skills";
    return {
      learnerId: r.learner.id,
      displayName: r.learner.displayName,
      avatarName: r.learner.displayName,
      gradeLabel: gradeLabel(r.learner.gradeBand),
      strugglingWith: skillName,
      status,
      lastActivityLabel: relativeDayLabel(lastActivityByLearner.get(r.learner.id) ?? null),
      suggestedAction:
        status === "at_risk" ? "Assign targeted practice" : "Review recent work",
      suggestedHref: `/teacher/learners/${r.learner.id}`,
    };
  });

  // --- Recent activity (from the tenant audit trail) -------------------
  const recentActivity: RecentActivityItem[] = learnerActivity.slice(0, 4).map((a) => {
    const learner = a.learnerId ? rosterById.get(a.learnerId) : undefined;
    const name = (a.metadata.learnerName as string | undefined) ?? learner?.displayName ?? "A learner";
    const skillName = (a.metadata.skillName as string | undefined) ?? null;
    const verb = a.action.includes("completed")
      ? "completed"
      : a.action.includes("started")
        ? "started"
        : "worked on";
    const text = skillName ? `${name} ${verb} ${skillName}` : `${name} ${verb} a lesson`;
    return {
      id: a.id,
      text,
      timeLabel: relativeDayLabel(a.occurredAt),
      tone: verb === "completed" ? ("success" as const) : ("primary" as const),
    };
  });

  // --- Assignments (due + grading queue) -------------------------------
  const activeAssignments = await settle(
    () => listTeacherAssignments(teacherUserId, tenantId, { status: "active" }),
    [],
  );
  const assignmentsGrading = activeAssignments.filter(
    (a) => (a.submissions ?? 0) > (a.graded ?? 0),
  ).length;

  // --- Class-average mastery + delta (from snapshots) ------------------
  const liveMeans = roster
    .map((l) => masteryByLearner.get(l.id)?.mean)
    .filter((m): m is number => typeof m === "number");
  const classAvgPct =
    liveMeans.length > 0
      ? Math.round((liveMeans.reduce((s, m) => s + m, 0) / liveMeans.length) * 100)
      : 0;

  const classAvgDeltaPct = await settle(
    async () => {
      const perLearner = await Promise.all(
        roster.map((l) => listMasterySnapshots(l.id, tenantId)),
      );
      let curSum = 0;
      let prevSum = 0;
      let n = 0;
      for (const snaps of perLearner) {
        if (snaps.length === 0) continue;
        const sorted = snaps
          .slice()
          .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
        const latest = sorted[sorted.length - 1];
        const prior = sorted.length > 1 ? sorted[sorted.length - 2] : sorted[0];
        curSum += latest.averageScore;
        prevSum += prior.averageScore;
        n += 1;
      }
      if (n === 0) return null;
      const delta = Math.round((curSum / n) * 100) - Math.round((prevSum / n) * 100);
      return delta;
    },
    null,
  );

  // Count across the FULL roster (the attention list is capped at 6 rows, so
  // it would undercount the glance KPIs).
  const allMeans = roster
    .map((l) => masteryByLearner.get(l.id)?.mean)
    .filter((m): m is number => typeof m === "number");
  const atRisk = allMeans.filter((m) => m < AT_RISK_MAX).length;
  const needSupport = allMeans.filter((m) => m >= AT_RISK_MAX && m < ON_TRACK_MIN).length;
  const totalLearners = new Set(roster.map((l) => l.id)).size;

  const glance: GlanceKpis = {
    classes: classes.length,
    learners: totalLearners,
    assignmentsDue: activeAssignments.length,
    assignmentsGrading,
    needSupport,
    atRisk,
    classAvgPct,
    classAvgDeltaPct,
  };

  // --- Upcoming calendar events ----------------------------------------
  const todayIso = new Date().toISOString().slice(0, 10);
  const events = await settle(
    () => listCalendarEventsForTeacher(teacherUserId, tenantId, { fromIso: todayIso, limit: 5 }),
    [],
  );
  const upcoming: UpcomingItem[] = events.map((e) => {
    const d = new Date(e.date);
    const dateLabel = Number.isNaN(d.getTime())
      ? "—"
      : String(d.getUTCDate());
    const monthLabel = Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" }).toUpperCase();
    return {
      id: e.id,
      dateLabel,
      monthLabel,
      title: e.title,
      subtitle: e.subtitle,
      type: e.type,
    };
  });

  return { classes, attention, recentActivity, glance, upcoming };
}
