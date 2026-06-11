/**
 * Session tenant branding for client surfaces (Sprint B6) — the same
 * presentation-safe fields the server shell injects, for client
 * components (e.g. the error page support link) that cannot read the
 * server helper. No tenant id accepted from the caller: the SESSION
 * decides whose branding you get.
 */
import { NextResponse } from "next/server";
import { getTenantBranding } from "@/lib/branding";

export async function GET(): Promise<Response> {
  const branding = await getTenantBranding();
  return NextResponse.json(
    { branding },
    { headers: { "cache-control": "private, max-age=60" } },
  );
}
