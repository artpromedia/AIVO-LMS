/** Mark an unmapped SCIM group push as reviewed (Sprint B5). POST body: { id }. */
import { NextRequest, NextResponse } from "next/server";
import { requirePageRole } from "@aivo/admin-auth";
import { resolveScimUnmappedGroup } from "@aivo/admin-api/scim";

export async function POST(request: NextRequest): Promise<Response> {
  const session = await requirePageRole(["district_admin", "platform_admin"]);
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "Record id is required." }, { status: 400 });
  }
  try {
    await resolveScimUnmappedGroup(session, body.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not mark as reviewed." }, { status: 502 });
  }
}
