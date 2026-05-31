import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

export interface ConsentRecordView {
  id: string;
  consentType: string;
  learnerId: string | null;
  version?: string | null;
  acceptedAt?: string | null;
  revokedAt?: string | null;
}

/**
 * Parent consent records — family-svc owns parent consent
 * (`GET /api/family/consent`, optional `?learnerId=`). Falls back to an
 * empty list when the endpoint is unavailable so the screen still
 * renders its explanatory shell.
 */
export function useConsents(learnerId?: string) {
  return useQuery<ConsentRecordView[]>({
    queryKey: ["consents", learnerId ?? "account"],
    queryFn: async () => {
      const qs = learnerId ? `?learnerId=${encodeURIComponent(learnerId)}` : "";
      const res = await apiFetch(API.FAMILY, `/api/family/consent${qs}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : Array.isArray(data?.records) ? data.records : [];
    },
    staleTime: 60 * 1000,
  });
}

export function useSetConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      consentType: string;
      learnerId?: string | null;
      granted: boolean;
    }) => {
      const res = await apiFetch(API.FAMILY, "/api/family/consent", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to update consent");
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consents"] });
    },
  });
}
