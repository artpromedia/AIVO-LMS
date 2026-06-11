/**
 * Shared identity-svc branding write helpers for the admin console
 * (Sprint B6). Platform admins target any tenant via ?tenantId=;
 * district admins are scoped by their token. Identity owns ALL
 * validation (contrast guard, logo type/size/dimensions, URL rules) —
 * these helpers just carry the bearer and surface identity's specific
 * error messages to the UI.
 */
import "server-only";

import { cookies } from "next/headers";
import { IDENTITY_ACCESS_TOKEN_COOKIE } from "@aivo/admin-auth/identity-client";

const IDENTITY_URL = process.env.IDENTITY_SVC_URL || "http://localhost:3001";

async function bearer(): Promise<string> {
  const jar = await cookies();
  return jar.get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value ?? "";
}

export interface BrandingPatch {
  displayName?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  supportUrl?: string | null;
  /** Explicitly clear the uploaded logo (reset). */
  resetLogo?: boolean;
}

export async function saveTenantBranding(
  patch: BrandingPatch,
  tenantId?: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  const branding: Record<string, unknown> = {
    displayName: patch.displayName ?? null,
    primaryColor: patch.primaryColor ?? null,
    secondaryColor: patch.secondaryColor ?? null,
    supportUrl: patch.supportUrl ?? null,
  };
  if (patch.resetLogo) branding.logoUrl = null;
  const res = await fetch(`${IDENTITY_URL}/api/district/settings${qs}`, {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${await bearer()}` },
    body: JSON.stringify({ branding }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, status: res.status, error: body.error ?? "Branding update failed." };
  }
  return { ok: true };
}

export async function uploadTenantLogo(
  logoDataUrl: string,
  tenantId?: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  const res = await fetch(`${IDENTITY_URL}/api/district/settings/branding/logo${qs}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${await bearer()}` },
    body: JSON.stringify({ dataUrl: logoDataUrl }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, status: res.status, error: body.error ?? "Logo upload failed." };
  }
  return { ok: true };
}
