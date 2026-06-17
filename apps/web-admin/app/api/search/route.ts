/**
 * Global ⌘K command-palette search endpoint.
 *
 * Server-gated (defence in depth — admin-svc enforces RBAC again): only a
 * valid platform session with `platform:read` may query. Fans a single term
 * across tenants / users / learners via the admin-api client (which forwards
 * the caller's identity token). Returns honest empty arrays for blank or
 * sub-threshold queries rather than erroring.
 */
import { NextResponse } from "next/server";
import { readAdminSessionFromCookies, sessionHasPermission } from "@aivo/admin-auth";
import { searchAdminEntities } from "@aivo/admin-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await readAdminSessionFromCookies();
  if (!session || !sessionHasPermission(session, "platform:read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ tenants: [], users: [], learners: [], pilots: [] });
  }

  try {
    const results = await searchAdminEntities(session, q);
    return NextResponse.json(results, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 502 });
  }
}
