import { requirePageRole } from "@aivo/admin-auth";
import { adminGet } from "@aivo/admin-api";
import { importTemplatePath } from "@aivo/admin-api/rostering";

const ROSTERING_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

/**
 * Colocated download proxy for the learner-import CSV template.
 *
 * The admin-svc template endpoint requires a Bearer token, so a raw browser
 * link can't hit it directly. This server route re-checks role, fetches the
 * template through the authenticated admin client, and streams it back as a
 * downloadable CSV.
 */
export async function GET(): Promise<Response> {
  const session = await requirePageRole([...ROSTERING_ROLES]);
  const csv = await adminGet<string>(session, importTemplatePath(session.tenantId));
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="learner-import-template.csv"',
    },
  });
}
