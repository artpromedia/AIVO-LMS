import { useQuery } from "@tanstack/react-query";
import { API } from "@/constants/api";
import { apiFetch } from "@/lib/api";

/**
 * Mirrors the family-svc `WhatsWorkingInsights` shape returned by
 * `GET /api/family/whats-working/:learnerId?windowDays=N`. Kept minimal —
 * the panel/card only reads the three IEP-ready signals.
 */
export interface WhatsWorkingInsights {
  windowDays: number;
  totalSessions: number;
  bestWindow: { timeOfDay: string; meanAccuracy: number } | null;
  modalityFit: { subject: string; modality: string; meanAccuracy: number }[];
  frustrationHotspots: { subject: string; modality: string; meanFrustration: number }[];
}

/** Pure fetcher — exported for tests so we can assert the wire contract. */
export async function fetchWhatsWorking(
  learnerId: string,
  windowDays: number,
): Promise<WhatsWorkingInsights> {
  const res = await apiFetch(
    API.FAMILY,
    `/api/family/whats-working/${learnerId}?windowDays=${windowDays}`,
  );
  if (!res.ok) {
    let message = "Failed to load insights";
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) message = j.error;
    } catch {
      /* fall through with default message */
    }
    throw new Error(message);
  }
  return (await res.json()) as WhatsWorkingInsights;
}

/**
 * React Query wrapper. Parent-only; family-svc enforces ownership.
 */
export function useWhatsWorking(learnerId: string, windowDays = 30) {
  return useQuery<WhatsWorkingInsights>({
    queryKey: ["whats-working", learnerId, windowDays],
    queryFn: () => fetchWhatsWorking(learnerId, windowDays),
    enabled: !!learnerId,
  });
}
