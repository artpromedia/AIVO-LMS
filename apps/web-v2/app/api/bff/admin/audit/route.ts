import { ok } from "@/lib/bff/response";
import { requireAuditViewer } from "@/lib/bff/audit-guard";
import { queryAudit, listAuditActions, type AuditFilter } from "@/lib/db/audit-store";

export const dynamic = "force-dynamic";

/** GET — paged audit query with server-injected tenant/school scope. */
export async function GET(req: Request) {
  const got = await requireAuditViewer(req);
  if ("err" in got) return got.err;
  const { scope, requestId } = got;
  const url = new URL(req.url);
  const p = url.searchParams;

  const filter: AuditFilter = {
    // Scope is forced server-side and cannot be widened by the client.
    tenantId: scope.tenantId,
    schoolId: scope.schoolId,
    actorId: p.get("actorId") ?? undefined,
    actorRole: p.get("actorRole") ?? undefined,
    action: p.getAll("action").length ? p.getAll("action") : undefined,
    entityType: p.get("entityType") ?? undefined,
    from: p.get("from") ?? undefined,
    to: p.get("to") ?? undefined,
    q: p.get("q") ?? undefined,
    cursor: p.get("cursor") ?? undefined,
    limit: p.get("limit") ? Number(p.get("limit")) : undefined,
  };

  const { events, nextCursor } = queryAudit(filter);
  return ok(
    {
      events,
      nextCursor,
      actions: listAuditActions({ tenantId: scope.tenantId, schoolId: scope.schoolId }),
      canViewProof: scope.canViewProof,
    },
    requestId,
  );
}
