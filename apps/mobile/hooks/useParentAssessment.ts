/**
 * Parent assessment persistence (mobile).
 *
 * Wires the mobile parent-assessment wizard to the real assessment-svc
 * endpoints — previously the wizard was local-state only and never saved.
 *
 *  - GET  assessment-svc /api/assessments/parent/:learnerId/status
 *  - POST assessment-svc /api/assessments/parent
 *
 * The POST persists a `parent_assessments` row, computes the learner's
 * functioning level (level-router) and updates the learner — the same
 * durable contract the web-v2 submit relies on.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

export type CommunicationMode =
  | "verbal"
  | "limited_verbal"
  | "non_verbal"
  | "pre_symbolic"
  | "aac_device"
  | "sign_language";

export type DeviceInteraction =
  | "independent"
  | "guided"
  | "switch_access"
  | "eye_gaze"
  | "partner_assisted";

export type ResponseMethod =
  | "typing"
  | "voice"
  | "touch_select"
  | "switch_scan"
  | "partner_response";

export type AttentionSpan = "typical" | "short" | "very_short" | "variable" | "task_dependent";

export interface ParentAssessmentStatus {
  completed: boolean;
  completedAt: string | null;
  assessmentId: string | null;
}

export interface SubmitParentAssessmentInput {
  learnerId: string;
  communicationMode: CommunicationMode;
  deviceInteraction: DeviceInteraction;
  responseMethod: ResponseMethod;
  attentionSpan?: AttentionSpan;
  diagnoses?: string[];
  /** Free-text sections (goals/strengths/…) preserved on the row's responses. */
  additionalResponses?: Record<string, unknown>;
}

export interface SubmitParentAssessmentResult {
  assessment: { id: string; completedAt: string | null };
  functioningLevel: { level: string; confidence: number };
}

export function useParentAssessmentStatus(learnerId: string) {
  return useQuery<ParentAssessmentStatus>({
    queryKey: ["parent-assessment-status", learnerId],
    queryFn: async () => {
      const res = await apiFetch(
        API.ASSESSMENT,
        `/api/assessments/parent/${learnerId}/status`,
      );
      if (!res.ok) throw new Error("Failed to fetch parent assessment status");
      return res.json();
    },
    enabled: !!learnerId,
  });
}

/**
 * Pure fetcher (exported for unit tests). POSTs the assessment and enforces
 * the no-silent-success guard. Throws on a non-2xx response or a response
 * that didn't persist a row.
 */
export async function submitParentAssessment(
  input: SubmitParentAssessmentInput,
): Promise<SubmitParentAssessmentResult> {
  const res = await apiFetch(API.ASSESSMENT, "/api/assessments/parent", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as Record<string, unknown>);
    throw new Error(
      (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        "Failed to save the assessment",
    );
  }
  const result = (await res.json()) as SubmitParentAssessmentResult;
  // No silent success (parity with web-v2): the row must have persisted with
  // an id, otherwise treat it as a failed save.
  if (!result?.assessment?.id) {
    throw new Error("The assessment did not save. Please try again.");
  }
  return result;
}

export function useSubmitParentAssessment() {
  const queryClient = useQueryClient();
  return useMutation<SubmitParentAssessmentResult, Error, SubmitParentAssessmentInput>({
    mutationFn: submitParentAssessment,
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["parent-assessment-status", vars.learnerId] });
      // The submit updates the learner's functioning level server-side.
      queryClient.invalidateQueries({ queryKey: ["learner", vars.learnerId] });
      queryClient.invalidateQueries({ queryKey: ["brain", vars.learnerId] });
    },
  });
}
