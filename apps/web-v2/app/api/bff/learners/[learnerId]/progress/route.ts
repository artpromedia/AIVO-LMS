/**
 * Sprint 14: GET /api/bff/learners/:learnerId/progress
 *
 * Returns the parent-facing progress aggregate: lifetime stats, mastery by
 * subject + skill, and the N most recent ParentLessonSummary records. Pages
 * render this directly — they never look at raw lesson interactions or AI
 * JSON.
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import {
  getLearner,
  getMasteryMap,
  listLessonRunsForLearner,
  listParentLessonSummaries,
  listSkills,
  listSubjects,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(
      session!,
      ["parent", "learner", "teacher", "school_admin"],
      requestId,
    );
    if (roleErr) return roleErr;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection"],
      requestId,
    );
    if (consentErr) return consentErr;

    const learner = await getLearner(learnerId, session!.tenantId);
    if (!learner) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Learner not found" }, requestId);
    }

    const { map, skillMasteries } = getMasteryMap(learnerId, session!.tenantId);
    const subjects = listSubjects();
    const subjectsById = new Map(subjects.map((s) => [s.id, s]));
    const skills = listSkills();
    const skillsById = new Map(skills.map((s) => [s.id, s]));

    const recentRuns = listLessonRunsForLearner(learnerId, session!.tenantId, {
      limit: 20,
    });
    const completedRuns = recentRuns.filter((r) => r.status === "completed");
    const summaries = listParentLessonSummaries(learnerId, session!.tenantId, { limit: 20 });

    // By-subject aggregation.
    const bySubject = subjects
      .map((subject) => {
        const subjectSkills = skills.filter((s) => s.subjectId === subject.id);
        const subjectMasteries = skillMasteries.filter((m) =>
          subjectSkills.some((s) => s.id === m.skillId),
        );
        if (subjectMasteries.length === 0) return null;
        const avg = subjectMasteries.reduce((acc, m) => acc + m.score, 0) / subjectMasteries.length;
        return {
          subjectId: subject.id,
          subjectName: subject.name,
          subjectSlug: subject.slug,
          averageScore: Math.round(avg * 100) / 100,
          skillCount: subjectMasteries.length,
          masteredCount: subjectMasteries.filter(
            (m) => m.level === "on_grade_level" || m.level === "stretching",
          ).length,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Enrich recent summaries with skill/subject display names.
    const recentSummaries = summaries.map((s) => ({
      ...s,
      subjectName: subjectsById.get(s.subjectId)?.name ?? "Learning",
      skillName: skillsById.get(s.skillId)?.name ?? "Skill",
    }));

    const stats = {
      lessonsCompleted: completedRuns.length,
      totalMinutes: completedRuns.reduce(
        (acc, r) =>
          acc +
          (r.completedAt && r.startedAt
            ? Math.round(
                (new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()) / 60000,
              )
            : 0),
        0,
      ),
      skillsTracked: skillMasteries.length,
      skillsMastered: skillMasteries.filter(
        (m) => m.level === "on_grade_level" || m.level === "stretching",
      ).length,
    };

    return ok(
      {
        learner: { id: learner.id, displayName: learner.displayName },
        stats,
        masteryMap: map,
        bySubject,
        recentSummaries,
      },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
