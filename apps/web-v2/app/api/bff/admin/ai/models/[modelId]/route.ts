import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ADMIN_ROLES } from "@/lib/bff/admin-scope";
import { getModelCard } from "@/lib/services/responsible-ai-svc";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ modelId: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { modelId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    return ok(await getModelCard(modelId, { requestId }), requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
