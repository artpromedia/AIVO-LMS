/** Platform-admin logo upload for any tenant (Sprint B6) — identity validates. */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPage } from "@aivo/admin-auth";
import { uploadTenantLogo } from "@/lib/branding-admin";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  await requirePlatformPage("platform:read");
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { logo?: string };
  if (!body.logo) return NextResponse.json({ error: "logo is required" }, { status: 400 });
  const result = await uploadTenantLogo(body.logo, id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
