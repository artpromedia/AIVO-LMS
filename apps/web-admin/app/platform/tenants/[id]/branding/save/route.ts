/** Platform-admin branding save for any tenant (Sprint B6). */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPage } from "@aivo/admin-auth";
import { saveTenantBranding, type BrandingPatch } from "@/lib/branding-admin";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  await requirePlatformPage("platform:read");
  const { id } = await context.params;
  const patch = (await request.json().catch(() => ({}))) as BrandingPatch;
  const result = await saveTenantBranding(patch, id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
