/**
 * Issue a district SCIM token (Sprint B5). POST body: { name }. The
 * plaintext is returned in the response body ONLY — never a URL — so it
 * can be shown once and copied without landing in logs or history.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePageRole } from "@aivo/admin-auth";
import { issueScimToken } from "@aivo/admin-api/scim";

export async function POST(request: NextRequest): Promise<Response> {
  const session = await requirePageRole(["district_admin", "platform_admin"]);
  if (!session.tenantId) {
    return NextResponse.json({ error: "No tenant context." }, { status: 400 });
  }
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Token name is required." }, { status: 400 });
  }
  try {
    const issued = await issueScimToken(session, session.tenantId, name);
    return NextResponse.json({ plaintext: issued.plaintext, token: issued.token });
  } catch {
    return NextResponse.json({ error: "Token could not be issued." }, { status: 502 });
  }
}
