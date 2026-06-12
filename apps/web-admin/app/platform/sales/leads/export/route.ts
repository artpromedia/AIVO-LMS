import { requirePageRole } from "@aivo/admin-auth";
import { adminGetRaw } from "@aivo/admin-api";

export const dynamic = "force-dynamic";

/** Sprint 11 — streams admin-svc's audited leads CSV to the browser. */
export async function GET(req: Request): Promise<Response> {
  const session = await requirePageRole(["platform_admin", "sales"]);
  const url = new URL(req.url);
  const search = url.searchParams.get("q") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const upstream = await adminGetRaw(session, "/api/admin-svc/leads/export.csv", {
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "text/csv; charset=utf-8",
      "content-disposition":
        upstream.headers.get("content-disposition") ?? 'attachment; filename="leads.csv"',
      "cache-control": "no-store",
    },
  });
}
