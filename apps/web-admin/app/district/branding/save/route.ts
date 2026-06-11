/**
 * District self-serve branding save (Sprint B6) — gated behind the
 * districtEnterpriseMode tenant flag (B2 resolver); platform support
 * manages branding for non-enterprise districts.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePageRole } from "@aivo/admin-auth";
import { districtEnterpriseModeEnabled } from "@/lib/district-flags";
import { saveTenantBranding, type BrandingPatch } from "@/lib/branding-admin";

export async function POST(request: NextRequest): Promise<Response> {
  await requirePageRole(["district_admin"]);
  if (!(await districtEnterpriseModeEnabled())) {
    return NextResponse.json(
      { error: "Self-serve branding requires district enterprise mode." },
      { status: 403 },
    );
  }
  const patch = (await request.json().catch(() => ({}))) as BrandingPatch;
  const result = await saveTenantBranding(patch);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
