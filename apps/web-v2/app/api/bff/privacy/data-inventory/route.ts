import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import {
  listDataInventory,
  listRetentionPolicies,
  listSubprocessors,
  listPolicyVersions,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(
      session!,
      ["parent", "school_admin", "district_admin", "platform_admin"],
      requestId,
    );
    if (roleErr) return roleErr;
    return ok(
      {
        items: listDataInventory(),
        retention: listRetentionPolicies(),
        subprocessors: listSubprocessors(),
        policies: listPolicyVersions(),
      },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
