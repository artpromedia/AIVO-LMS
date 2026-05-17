"use client";
/**
 * Sprint 9 — public tenant branding consumer.
 *
 * `useTenantBranding(tenantId)` fetches `/api/branding/public/:tenantId`
 * and returns `{ branding, ready }`. Falls back silently to AIVO defaults
 * when the tenant has no branding row, the request fails, or no tenant
 * id is in scope. Result is memoized via `sessionStorage` so we don't
 * re-fetch on every page navigation.
 *
 * `applyBrandingCssVars` writes `--tenant-primary` to `document.documentElement`
 * so any component using `var(--tenant-primary, var(--visual-primary))`
 * picks up the override automatically.
 */
import { useEffect, useState } from "react";

export interface PublicBranding {
  displayName: string | null;
  primaryColor: string | null;
  logoUrl: string | null;
  supportEmail: string | null;
}

const DEFAULT: PublicBranding = { displayName: null, primaryColor: null, logoUrl: null, supportEmail: null };
const CACHE_KEY = (id: string) => `aivo:branding:${id}`;

/**
 * Defense-in-depth: even though the backend's logo upload route validates
 * PNG/SVG/size, we re-check on the client before assigning to <img src> so
 * a misconfigured tenant or compromised admin cannot inject an arbitrary
 * external URL (tracker, javascript:, etc.) into every learner/parent page.
 * Only inline data URLs for png/svg or trusted relative paths are accepted.
 */
function isSafeLogoUrl(url: unknown): url is string {
  if (typeof url !== "string" || url.length === 0) return false;
  if (url.length > 300_000) return false; // matches 200KB upload cap w/ base64 overhead
  if (url.startsWith("data:image/png;base64,")) return true;
  if (url.startsWith("data:image/svg+xml;base64,")) return true;
  if (url.startsWith("/images/") || url.startsWith("/branding/")) return true;
  return false;
}

function sanitize(b: PublicBranding): PublicBranding {
  return { ...b, logoUrl: isSafeLogoUrl(b.logoUrl) ? b.logoUrl : null };
}

export function useTenantBranding(tenantId: string | null | undefined) {
  const [branding, setBranding] = useState<PublicBranding>(DEFAULT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!tenantId) { setReady(true); return; }
    let alive = true;
    try {
      const cached = sessionStorage.getItem(CACHE_KEY(tenantId));
      if (cached) {
        const parsed = sanitize(JSON.parse(cached) as PublicBranding);
        setBranding(parsed); applyBrandingCssVars(parsed); setReady(true);
      }
    } catch { /* ignore */ }

    fetch(`/api/branding/public/${encodeURIComponent(tenantId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!alive || !data?.branding) return;
        const b: PublicBranding = sanitize({
          displayName: data.branding.displayName ?? null,
          primaryColor: data.branding.primaryColor ?? null,
          logoUrl: data.branding.logoUrl ?? null,
          supportEmail: data.branding.supportEmail ?? null,
        });
        setBranding(b);
        applyBrandingCssVars(b);
        try { sessionStorage.setItem(CACHE_KEY(tenantId), JSON.stringify(b)); } catch { /* quota */ }
      })
      .catch(() => { /* fall back to defaults */ })
      .finally(() => { if (alive) setReady(true); });

    return () => { alive = false; };
  }, [tenantId]);

  return { branding, ready };
}

export function applyBrandingCssVars(b: PublicBranding) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (b.primaryColor) {
    root.style.setProperty("--tenant-primary", b.primaryColor);
  } else {
    root.style.removeProperty("--tenant-primary");
  }
}
