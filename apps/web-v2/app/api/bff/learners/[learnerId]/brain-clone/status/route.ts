import { NextResponse } from "next/server";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { getRequestId } from "@/lib/bff/response";
import { getBrainProfile, updateBrainProfilePipelineState } from "@/lib/db/repos";
import { cloneStageProgress, normalizeCloneStage } from "@/lib/learner/brain-clone-stage";
import { IDENTITY_ACCESS_TOKEN_COOKIE } from "@/lib/auth/identity-client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

function fromCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const [k, ...rest] = part.split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function brainSvcBaseUrl(): string {
  return (process.env.BRAIN_SVC_URL ?? "http://localhost:3033").replace(/\/+$/, "");
}

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  const { session, response } = await requireSession(req, requestId);
  if (response) return response;
  const roleErr = requireRole(session!, ["parent", "learner"], requestId);
  if (roleErr) return roleErr;
  const scopeErr = requireLearnerScope(session!, learnerId, requestId);
  if (scopeErr) return scopeErr;

  const local = getBrainProfile(learnerId, session!.tenantId);
  const authHeader = req.headers.get("authorization");
  const accessFromCookie = fromCookie(req.headers.get("cookie"), IDENTITY_ACCESS_TOKEN_COOKIE);
  const bearer = authHeader ?? (accessFromCookie ? ["Bearer", accessFromCookie].join(" ") : null);

  let cloneStage = local?.cloneStage ?? "building";

  try {
    const upstream = await fetch(`${brainSvcBaseUrl()}/api/brain/${encodeURIComponent(learnerId)}`, {
      headers: {
        ...(bearer ? { authorization: bearer } : {}),
        ...(process.env.BRAIN_SVC_SERVICE_TOKEN
          ? {
              "x-internal-service": "web-v2",
              "x-service-token": process.env.BRAIN_SVC_SERVICE_TOKEN,
            }
          : {}),
      },
      cache: "no-store",
    });
    if (upstream.ok) {
      const data = (await upstream.json()) as Record<string, unknown>;
      cloneStage = normalizeCloneStage(data.cloneStage ?? data.approvalStatus ?? data.approval_status);
      updateBrainProfilePipelineState(learnerId, session!.tenantId, {
        cloneStage,
        brainProfileId: typeof data.id === "string" ? data.id : null,
      });
      const progress = cloneStageProgress(cloneStage);
      const total = Number(data.totalSteps);
      const completed = Number(data.completedSteps);
      return NextResponse.json({
        cloneStage,
        completedSteps: Number.isFinite(completed) ? completed : progress.completedSteps,
        totalSteps: Number.isFinite(total) ? total : progress.totalSteps,
        currentStep:
          typeof data.currentStep === "string" || data.currentStep === null
            ? data.currentStep
            : progress.currentStep,
      });
    }
  } catch {
    // Fall through to local status.
  }

  const progress = cloneStageProgress(cloneStage);
  return NextResponse.json({ cloneStage, ...progress });
}
