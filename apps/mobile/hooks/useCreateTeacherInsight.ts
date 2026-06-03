/**
 * Teacher insight mutation.
 *
 * POSTs to `family-svc`'s `/api/family/teacher-insights`. The handler
 * persists the insight into the dedicated `teacher_insights` table AND
 * mirrors it into `brain_insights` (source = "teacher") so the existing
 * learner-brain readers keep working without a migration.
 *
 * Web parity: `apps/web-v2/app/api/bff/teacher/insights/route.ts` proxies
 * the same payload via the ADR 0009 dual-path pattern.
 */
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

export interface CreateTeacherInsightInput {
  learnerId: string;
  insightText: string;
  domain?: string;
}

export interface CreateTeacherInsightResult {
  insight: unknown;
}

/**
 * Pure fetcher (exported for unit tests — fakes that skip apiFetch fail
 * the mocked spy).
 */
export async function createTeacherInsight(
  input: CreateTeacherInsightInput,
): Promise<CreateTeacherInsightResult> {
  const res = await apiFetch(API.FAMILY, "/api/family/teacher-insights", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Failed to submit insight");
  }
  return (await res.json()) as CreateTeacherInsightResult;
}

export function useCreateTeacherInsight() {
  return useMutation({ mutationFn: createTeacherInsight });
}
