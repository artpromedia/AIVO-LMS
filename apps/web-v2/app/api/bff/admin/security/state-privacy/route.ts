import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import {
  listSecurityControls,
  listStatePrivacyMappingsFor,
  listStatePrivacyRequirements,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;
    const controls = await listSecurityControls();
    const requirements = await listStatePrivacyRequirements();
    const matrix = await Promise.all(
      requirements.map(async (req) => ({
        requirement: req,
        mappings: (await listStatePrivacyMappingsFor(req.id)).map((m) => ({
          mapping: m,
          control: controls.find((c) => c.id === m.controlId) ?? null,
        })),
      })),
    );
    return ok({ controls, matrix }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
