/**
 * Tenant-scoped feature flags on mobile (Sprint B2).
 *
 * Fetches the caller's resolved flags from identity-svc
 * (`GET /api/users/me/flags` — kill switch > district override > env
 * default) once per auth session via react-query. Until the fetch lands —
 * or when it fails — every flag reads `false`: surfaces gate fail-closed,
 * matching the OFF-biased platform defaults.
 */
import { useQuery } from "@tanstack/react-query";
import { API } from "@/constants/api";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export interface MobileFlags {
  selfRegulationHub: boolean;
  problemSessionLedger: boolean;
  tutorSurfaceProtocol: boolean;
  [key: string]: boolean;
}

const NO_FLAGS: MobileFlags = {
  selfRegulationHub: false,
  problemSessionLedger: false,
  tutorSurfaceProtocol: false,
};

export function useFlags(): { flags: MobileFlags; isLoading: boolean } {
  const { isAuthenticated } = useAuth();
  const query = useQuery({
    queryKey: ["tenant-flags"],
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<MobileFlags> => {
      const res = await apiFetch(API.IDENTITY, "/api/users/me/flags");
      if (!res.ok) return NO_FLAGS;
      const json = (await res.json().catch(() => null)) as {
        flags?: Record<string, boolean>;
      } | null;
      return { ...NO_FLAGS, ...(json?.flags ?? {}) };
    },
  });
  return { flags: query.data ?? NO_FLAGS, isLoading: query.isLoading };
}
