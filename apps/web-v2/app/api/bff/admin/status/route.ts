import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ADMIN_ROLES } from "@/lib/bff/admin-scope";
import { getPublicSummary, listComponents, getBudgets } from "@/lib/services/status-page-svc";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    const summary = await getPublicSummary(undefined, { requestId });
    const components = await listComponents({ requestId });
    const budgets = await getBudgets(undefined, undefined, { requestId });
    return ok({ summary, components, budgets }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
