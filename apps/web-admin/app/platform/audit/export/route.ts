import { requirePlatformPage } from "@aivo/admin-auth";
import { adminGetRaw } from "@aivo/admin-api";

export const dynamic = "force-dynamic";

/** Sprint B3 — streams admin-svc's audited CSV export to the browser. */
export async function GET(req: Request): Promise<Response> {
  const session = await requirePlatformPage("platform:read");
  const url = new URL(req.url);
  const search = url.searchParams.get("q") ?? undefined;
  const upstream = await adminGetRaw(session, "/api/admin-svc/audit-log/export.csv", {
    ...(search ? { search } : {}),
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "text/csv; charset=utf-8",
      "content-disposition":
        upstream.headers.get("content-disposition") ?? 'attachment; filename="audit.csv"',
      "cache-control": "no-store",
    },
  });
}
