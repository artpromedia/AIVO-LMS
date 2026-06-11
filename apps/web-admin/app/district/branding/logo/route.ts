/** District self-serve logo upload (Sprint B6) — flag-gated, identity validates. */
import { NextRequest, NextResponse } from "next/server";
import { requirePageRole } from "@aivo/admin-auth";
import { districtEnterpriseModeEnabled } from "@/lib/district-flags";
import { uploadTenantLogo } from "@/lib/branding-admin";

export async function POST(request: NextRequest): Promise<Response> {
  await requirePageRole(["district_admin"]);
  if (!(await districtEnterpriseModeEnabled())) {
    return NextResponse.json(
      { error: "Self-serve branding requires district enterprise mode." },
      { status: 403 },
    );
  }
  const body = (await request.json().catch(() => ({}))) as { logo?: string };
  if (!body.logo) return NextResponse.json({ error: "logo is required" }, { status: 400 });
  const result = await uploadTenantLogo(body.logo);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
