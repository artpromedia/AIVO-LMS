import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { getAudioAsset } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string; audioAssetId: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId, audioAssetId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const scopeErr = requireLearnerScope(session!, learnerId, requestId);
    if (scopeErr) return scopeErr;
    const consentErr = requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection"],
      requestId,
    );
    if (consentErr) return consentErr;
    const asset = getAudioAsset(audioAssetId);
    if (!asset) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Audio asset not found." }, requestId);
    }
    if (asset.tenantId !== session!.tenantId) {
      return fail(
        { ...ERRORS.FORBIDDEN_TENANT, message: "Audio belongs to another tenant." },
        requestId,
      );
    }
    return ok({ asset }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
