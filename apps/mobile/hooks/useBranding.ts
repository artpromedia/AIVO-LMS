/**
 * Tenant white-label branding on mobile (Sprint B6).
 *
 * Post-login, fetches the session tenant's presentation-safe branding
 * from identity-svc's public endpoint (the same source web uses). On
 * mobile the override surface is the LOGO only: every mobile screen —
 * parent and teacher included — renders through the sensory palette
 * system, and tenant accents are not allowed to fight those clinically
 * tuned palettes (see docs/design/white-label.md). Pre-auth screens stay
 * AIVO-branded by design: no tenant is known yet.
 */
import { useQuery } from "@tanstack/react-query";
import { API } from "@/constants/api";
import { useAuth } from "@/hooks/useAuth";

export interface MobileBranding {
  displayName: string | null;
  logoUrl: string | null;
  supportUrl: string | null;
  supportEmail: string | null;
}

const NO_BRANDING: MobileBranding = {
  displayName: null,
  logoUrl: null,
  supportUrl: null,
  supportEmail: null,
};

export function useBranding(): { branding: MobileBranding; isLoading: boolean } {
  const { isAuthenticated, user } = useAuth();
  const tenantId = user?.tenantId ?? "";
  const query = useQuery({
    queryKey: ["tenant-branding", tenantId],
    enabled: isAuthenticated && !!tenantId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<MobileBranding> => {
      const res = await fetch(
        `${API.IDENTITY}/api/branding/public/${encodeURIComponent(tenantId)}`,
      );
      if (!res.ok) return NO_BRANDING;
      const json = (await res.json().catch(() => null)) as {
        branding?: {
          displayName?: string | null;
          logoUrl?: string | null;
          supportUrl?: string | null;
          supportEmail?: string | null;
        };
      } | null;
      const b = json?.branding;
      if (!b?.logoUrl && !b?.supportUrl) return NO_BRANDING;
      return {
        displayName: b?.displayName ?? null,
        logoUrl: b?.logoUrl ?? null,
        supportUrl: b?.supportUrl ?? null,
        supportEmail: b?.supportEmail ?? null,
      };
    },
  });
  return { branding: query.data ?? NO_BRANDING, isLoading: query.isLoading };
}
