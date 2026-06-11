/**
 * Tenant white-label branding for web-v2 (Sprint B6).
 *
 * `getTenantBranding()` resolves the signed-in session's tenant and reads
 * identity-svc's PUBLIC branding endpoint (presentation-safe fields only).
 * The override surface is deliberately tiny: header logo, primary /
 * secondary accent variables, and the support link. Learner sensory
 * palettes are NEVER overridden — see docs/design/white-label.md.
 *
 *  - Mock mode / logged-out / B2C family tenants without branding → null
 *    (AIVO default chrome).
 *  - Identity unreachable → null (branding must never break a page).
 *  - Responses memoized per tenant for 60s in-process (the endpoint
 *    itself is also CDN-cacheable: public, max-age=300).
 */
import { getSession } from "@/lib/auth/session";
import { isMockAuthAllowed } from "@/lib/auth/mock-session";
import { serverEnv } from "@/lib/env";
import { shadeHex } from "@aivo/brand";

export interface TenantBranding {
  tenantId: string;
  displayName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  supportEmail: string | null;
  supportUrl: string | null;
}

const memo = new Map<string, { value: TenantBranding | null; at: number }>();
const MEMO_TTL_MS = 60_000;

export async function getTenantBranding(): Promise<TenantBranding | null> {
  if (isMockAuthAllowed()) return null;
  const session = await getSession();
  const tenantId = session?.tenantId;
  if (!tenantId) return null;
  return getTenantBrandingById(tenantId);
}

export async function getTenantBrandingById(tenantId: string): Promise<TenantBranding | null> {
  const hit = memo.get(tenantId);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.value;
  let value: TenantBranding | null = null;
  try {
    const res = await fetch(
      `${serverEnv.IDENTITY_SVC_URL}/api/branding/public/${encodeURIComponent(tenantId)}`,
      { next: { revalidate: 300 } },
    );
    if (res.ok) {
      const json = (await res.json()) as {
        tenant?: { id?: string };
        branding?: {
          displayName?: string | null;
          logoUrl?: string | null;
          primaryColor?: string | null;
          secondaryColor?: string | null;
          supportEmail?: string | null;
          supportUrl?: string | null;
        };
      };
      const b = json.branding ?? {};
      const hasAny = Boolean(b.logoUrl || b.primaryColor || b.secondaryColor || b.supportUrl);
      value = hasAny
        ? {
            tenantId,
            displayName: b.displayName ?? "",
            logoUrl: b.logoUrl ?? null,
            primaryColor: b.primaryColor ?? null,
            secondaryColor: b.secondaryColor ?? null,
            supportEmail: b.supportEmail ?? null,
            supportUrl: b.supportUrl ?? null,
          }
        : null;
    }
  } catch {
    value = null; // identity unreachable — default AIVO chrome
  }
  memo.set(tenantId, { value, at: Date.now() });
  return value;
}

/**
 * CSS custom-property overrides for a branded tenant. Maps the tenant
 * accents onto the interactive-primary token chain (focus rings and
 * primary buttons follow automatically) plus the dedicated brand vars.
 * Hover/active are derived shades so interaction feedback survives.
 */
export function brandingCssVars(branding: TenantBranding): Record<string, string> {
  const vars: Record<string, string> = {};
  if (branding.primaryColor) {
    vars["--aivo-color-interactive-primary-default"] = branding.primaryColor;
    vars["--aivo-color-interactive-primary-hover"] = shadeHex(branding.primaryColor, 0.88);
    vars["--aivo-color-interactive-primary-active"] = shadeHex(branding.primaryColor, 0.76);
    vars["--aivo-brand-primary"] = branding.primaryColor;
  }
  if (branding.secondaryColor) {
    vars["--aivo-brand-secondary"] = branding.secondaryColor;
    vars["--color-aivo-accent"] = branding.secondaryColor;
  }
  return vars;
}
