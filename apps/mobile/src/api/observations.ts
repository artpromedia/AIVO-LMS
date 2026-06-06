/**
 * Caregiver observations read client.
 *
 * Mirrors the web caregiver observations surface
 * (`apps/web-v2/app/caregiver/observations`). The web page renders
 * server-side from the `caregiver_observations` table; on mobile we read
 * the same data over family-svc's `GET /api/family/observations?learnerId=…`
 * endpoint (the inverse of the existing `POST` used by the per-child
 * "Submit observation" screen).
 *
 * The query key is intentionally `["observations", learnerId]` so the
 * existing `useCreateObservation` mutation's invalidation refreshes this
 * feed the moment a caregiver files a new note.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

/** A single caregiver observation row, camelCased from family-svc. */
export interface CaregiverObservation {
  id: string;
  learnerId: string;
  submittedBy?: string;
  category: string;
  notes: string;
  mood?: string | null;
  /** When the behaviour was observed (ISO). */
  date: string;
  createdAt?: string;
}

/**
 * Pure fetcher (exported for unit tests). Throws on a non-2xx response so
 * the screen can surface a real error state rather than an empty list.
 */
export async function fetchObservations(learnerId: string): Promise<CaregiverObservation[]> {
  if (!learnerId) return [];
  const res = await apiFetch(
    API.FAMILY,
    `/api/family/observations?learnerId=${encodeURIComponent(learnerId)}`,
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Failed to load observations");
  }
  const data = (await res.json().catch(() => null)) as
    | { observations?: CaregiverObservation[] }
    | CaregiverObservation[]
    | null;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.observations)) return data.observations;
  return [];
}

export function useObservations(learnerId: string) {
  return useQuery<CaregiverObservation[]>({
    queryKey: ["observations", learnerId],
    queryFn: () => fetchObservations(learnerId),
    enabled: !!learnerId,
    staleTime: 30 * 1000,
  });
}
