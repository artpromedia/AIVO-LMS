/**
 * Sprint C-07 — teacher assessment completion status (server-side).
 *
 * Used by the parent care-team surface to show a "Contributed ✓" badge for
 * a teacher whose assessment is submitted (EDIT-1). Authoritative source is
 * assessment-svc's status route (`GET /api/assessments/teacher/:learnerId/
 * status`); when that is unavailable (dev/mock, or a transient outage) we
 * fall back to the web-v2 draft store's `submittedAt` for the teacher — the
 * same flag the submit BFF stamps — so the badge is correct in every mode.
 *
 * Server-only: do not import from client components.
 */
import { serverEnv } from "@/lib/env";
import { findTeacherAssessmentDraft } from "@/lib/db/repos";

/**
 * True if THIS teacher has a submitted assessment for the learner. The
 * assessment-svc status route reports the learner's latest completed
 * teacher assessment (not per-teacher), so we treat a completed status as
 * authoritative-for-the-learner and additionally honor the per-teacher
 * local draft flag — a teacher who just submitted is "contributed" even if
 * the service read lags.
 */
export async function hasTeacherContributed(
  learnerId: string,
  tenantId: string,
  teacherUserId: string,
): Promise<boolean> {
  // Per-teacher local signal first (cheap, exact, works in every mode).
  const draft = await findTeacherAssessmentDraft(learnerId, tenantId, teacherUserId);
  if (draft?.submittedAt) return true;

  // Authoritative service read (covers submissions made on other surfaces
  // / before this draft store existed). Best-effort; never throws.
  try {
    const res = await fetch(
      `${serverEnv.ASSESSMENT_SVC_URL}/api/assessments/teacher/${encodeURIComponent(
        learnerId,
      )}/status`,
      {
        method: "GET",
        headers: {
          "content-type": "application/json",
          "x-internal-service": "web-v2-bff",
          ...(serverEnv.ASSESSMENT_SVC_SERVICE_TOKEN
            ? { "x-service-token": serverEnv.ASSESSMENT_SVC_SERVICE_TOKEN }
            : {}),
        },
        cache: "no-store",
      },
    );
    if (!res.ok) return false;
    const json = (await res.json().catch(() => ({}))) as { completed?: unknown };
    return Boolean(json.completed);
  } catch {
    return false;
  }
}
