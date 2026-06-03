/**
 * Caregiver observation mutation.
 *
 * POSTs to the existing `family-svc` `/api/family/observations` endpoint —
 * the same payload the web caregiver surfaces use. Persists into the
 * `caregiver_observations` table with full audit trail. The mobile screen
 * navigates back only on a 2xx response.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

export interface CreateObservationInput {
  learnerId: string;
  notes: string;
  category?: string;
  mood?: string;
}

/**
 * Pure fetcher (exported for unit tests — a fake save that bypasses
 * apiFetch is caught by the spy and fails the test).
 */
export async function createObservation(input: CreateObservationInput): Promise<unknown> {
  const res = await apiFetch(API.FAMILY, "/api/family/observations", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Failed to submit observation");
  }
  return res.json();
}

export function useCreateObservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createObservation,
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["observations", variables.learnerId],
      });
    },
  });
}
