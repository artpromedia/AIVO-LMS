/**
 * Teacher assessment persistence (mobile).
 *
 * Wires the mobile teacher classroom-assessment wizard to the real backend,
 * mirroring web-v2's teacher-assessment BFF submit:
 *
 *  - GET  assessment-svc /api/assessments/teacher/:learnerId/status
 *  - POST assessment-svc /api/assessments/teacher                (system of record)
 *  - POST family-svc      /api/family/teacher-insights           (best-effort mirror)
 *
 * The assessment-svc POST persists a `teacher_assessments` row with
 * `completedAt` set — that is the authoritative contribution signal the
 * parent "Contributed" badge reads (assessment-svc status `completed`). The
 * family-svc mirror feeds the brain-clone collaborator fold; a failure there
 * NEVER fails the submit (reported as `mirror: "deferred"`) so there is no
 * silent loss, exactly like the web BFF.
 *
 * assessment-svc independently re-enforces the ACCEPTED `learner_teachers`
 * link (RBAC), so a teacher with no link to the learner gets a 403 here.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
import {
  toTeacherSubmitPayload,
  toTeacherInsightSummary,
  type TeacherAssessmentAnswers,
} from "@/lib/teacher/assessment-projection";

export interface TeacherAssessmentStatus {
  completed: boolean;
  completedAt: string | null;
  assessmentId: string | null;
  teacherRole: string | null;
}

export interface SubmitTeacherAssessmentInput {
  learnerId: string;
  /** Learner display name — only used for the family-svc insight summary. */
  learnerName: string;
  answers: TeacherAssessmentAnswers;
}

export interface SubmitTeacherAssessmentResult {
  assessment: { id: string; completedAt: string | null };
  /** Whether the family-svc collaborator-fold mirror succeeded. */
  mirror: "written" | "deferred";
}

export function useTeacherAssessmentStatus(learnerId: string) {
  return useQuery<TeacherAssessmentStatus>({
    queryKey: ["teacher-assessment-status", learnerId],
    queryFn: async () => {
      const res = await apiFetch(
        API.ASSESSMENT,
        `/api/assessments/teacher/${learnerId}/status`,
      );
      if (!res.ok) throw new Error("Failed to fetch teacher assessment status");
      return res.json();
    },
    enabled: !!learnerId,
  });
}

/**
 * Pure fetcher (exported for unit tests). Projects the accumulated answers,
 * POSTs to assessment-svc (system of record) and enforces the no-silent-success
 * guard, then best-effort mirrors a summary insight to family-svc. Throws on a
 * non-2xx assessment-svc response or a response that didn't persist a row; the
 * family-svc mirror never throws (its failure is surfaced as `mirror:
 * "deferred"`).
 */
export async function submitTeacherAssessment(
  input: SubmitTeacherAssessmentInput,
): Promise<SubmitTeacherAssessmentResult> {
  const payload = toTeacherSubmitPayload(input.learnerId, input.answers);

  const res = await apiFetch(API.ASSESSMENT, "/api/assessments/teacher", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as Record<string, unknown>);
    throw new Error(
      (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        "Failed to save the assessment",
    );
  }
  const result = (await res.json()) as { assessment?: { id?: string; completedAt?: string | null } };
  // No silent success (parity with web-v2): the row must have persisted with
  // an id, otherwise treat it as a failed save.
  if (!result?.assessment?.id) {
    throw new Error("The assessment did not save. Please try again.");
  }

  // Best-effort family-svc mirror so the brain-clone collaborator fold sees the
  // contribution. A failure here NEVER fails the submit (the system-of-record
  // write already succeeded) — reported as a deferred mirror, no silent loss.
  let mirror: "written" | "deferred" = "deferred";
  try {
    const summary = toTeacherInsightSummary(input.learnerName, input.answers);
    const mirrorRes = await apiFetch(API.FAMILY, "/api/family/teacher-insights", {
      method: "POST",
      body: JSON.stringify({
        learnerId: input.learnerId,
        insightText: summary.insightText,
        domain: summary.domain,
      }),
    });
    if (mirrorRes.ok) mirror = "written";
  } catch {
    mirror = "deferred";
  }

  return {
    assessment: {
      id: result.assessment.id,
      completedAt: result.assessment.completedAt ?? null,
    },
    mirror,
  };
}

export function useSubmitTeacherAssessment() {
  const queryClient = useQueryClient();
  return useMutation<SubmitTeacherAssessmentResult, Error, SubmitTeacherAssessmentInput>({
    mutationFn: submitTeacherAssessment,
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["teacher-assessment-status", vars.learnerId] });
      // The contribution can surface on the learner's brain/collaborator fold.
      queryClient.invalidateQueries({ queryKey: ["brain", vars.learnerId] });
    },
  });
}
