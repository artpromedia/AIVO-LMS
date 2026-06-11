/**
 * District branding for the admin console shells (Sprint B6) — reads
 * identity-svc's public presentation-safe endpoint for the session
 * tenant. Best-effort: an unreachable identity must never block an
 * admin page, so failures resolve to null (AIVO default chrome).
 */
import "server-only";

export interface AdminTenantBranding {
  displayName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  supportUrl: string | null;
}

const IDENTITY_URL = process.env.IDENTITY_SVC_URL || "http://localhost:3001";

export async function getTenantBrandingById(
  tenantId: string | null | undefined,
): Promise<AdminTenantBranding | null> {
  if (!tenantId) return null;
  try {
    const res = await fetch(
      `${IDENTITY_URL}/api/branding/public/${encodeURIComponent(tenantId)}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      branding?: {
        displayName?: string | null;
        logoUrl?: string | null;
        primaryColor?: string | null;
        secondaryColor?: string | null;
        supportUrl?: string | null;
      };
    };
    const b = json.branding ?? {};
    if (!b.logoUrl && !b.primaryColor && !b.secondaryColor && !b.supportUrl) return null;
    return {
      displayName: b.displayName ?? "",
      logoUrl: b.logoUrl ?? null,
      primaryColor: b.primaryColor ?? null,
      secondaryColor: b.secondaryColor ?? null,
      supportUrl: b.supportUrl ?? null,
    };
  } catch {
    return null;
  }
}
