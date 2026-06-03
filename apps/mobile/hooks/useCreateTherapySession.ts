/**
 * Therapist session note mutation.
 *
 * POSTs to `family-svc`'s `/api/family/therapy-sessions` — the same contract
 * the web BFF (`apps/web-v2/app/api/bff/therapist/sessions/route.ts`) uses.
 * Persists into the `therapy_sessions` table with full audit trail.
 *
 * The mutation surfaces `isPending` / `isError` / `error` so the screen can
 * disable the Save button while in-flight and re-prompt on failure — there
 * is no optimistic "Saved" UX here. Clinical data either persists or fails
 * loudly. The mobile screen navigates back only on a 2xx response.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

export interface CreateTherapySessionInput {
  learnerId: string;
  outcome: string;
  skillTargeted?: string;
  method?: string;
  recommendations?: string;
  durationMinutes?: number;
  goalIds?: string[];
}

export interface CreateTherapySessionResult {
  session: unknown;
}

/**
 * Pure fetcher (exported for unit tests that need to assert a real network
 * write happens — a fake "save success without calling apiFetch" fails the
 * mocked apiFetch spy).
 */
export async function createTherapySession(
  input: CreateTherapySessionInput,
): Promise<CreateTherapySessionResult> {
  const res = await apiFetch(API.FAMILY, "/api/family/therapy-sessions", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Failed to save session notes");
  }
  return (await res.json()) as CreateTherapySessionResult;
}

/**
 * React Query mutation wrapper. Invalidates the per-learner session feed on
 * success so the dashboard re-fetches.
 */
export function useCreateTherapySession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTherapySession,
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["therapy-sessions", variables.learnerId],
      });
    },
  });
}
