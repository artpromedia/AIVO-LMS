import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession } from "@/lib/bff/guards";
import { listSkills, listSubjects } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const allSubjects = await listSubjects();
    const subjects = await Promise.all(
      allSubjects.map(async (s) => ({
        ...s,
        skillCount: (await listSkills(s.id)).length,
      })),
    );
    return ok({ subjects, sessionTenantId: session!.tenantId }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
