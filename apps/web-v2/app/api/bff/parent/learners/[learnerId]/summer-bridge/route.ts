/**
 * Wave D (G6) — summer-bridge opt-in (parent surface).
 * GET   /api/bff/parent/learners/:learnerId/summer-bridge → { optIn }
 * PATCH /api/bff/parent/learners/:learnerId/summer-bridge { optIn }
 *
 * Proxies brain-svc's pacing summer-bridge endpoints with the shared
 * service token after the parent session/scope guards. Live-only (the
 * pacing tables live in brain-svc; same fail-closed contract as the
 * pacing-plan routes) — in dev without INTERNAL_SERVICE_TOKEN this
 * returns a precise UPSTREAM_UNAVAILABLE instead of faking a toggle.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

const IS_PROD = process.env.NODE_ENV === "production";

function liveOrError(requestId: string): NextResponse | null {
  if (serverEnv.INTERNAL_SERVICE_TOKEN) return null;
  if (IS_PROD) {
    throw new Error(
      "summer-bridge: INTERNAL_SERVICE_TOKEN must be set in production (brain-svc owns the pacing tables).",
    );
  }
  return fail(
    {
      ...ERRORS.UPSTREAM_UNAVAILABLE,
      message:
        "Summer bridge runs in brain-svc; set INTERNAL_SERVICE_TOKEN (and run brain-svc) to use it in this environment.",
    },
    requestId,
  );
}

function bridgeUrl(learnerId: string): string {
  const base = serverEnv.BRAIN_SVC_URL.replace(/\/$/, "");
  return `${base}/api/brain/pacing/${encodeURIComponent(learnerId)}/pacing/summer-bridge`;
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-service-token": serverEnv.INTERNAL_SERVICE_TOKEN ?? "",
  };
}

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const notLive = liveOrError(requestId);
    if (notLive) return notLive;

    const res = await fetch(bridgeUrl(learnerId), {
      headers: headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(serverEnv.AIVO_SERVICE_TIMEOUT_MS),
    });
    if (!res.ok) {
      return fail(
        { ...ERRORS.UPSTREAM_UNAVAILABLE, message: `brain-svc summer-bridge read failed (${res.status})` },
        requestId,
      );
    }
    const data = (await res.json()) as { optIn?: boolean };
    return ok({ optIn: data.optIn === true }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

const patchSchema = z.object({ optIn: z.boolean() });

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const notLive = liveOrError(requestId);
    if (notLive) return notLive;

    const json = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
    }

    const res = await fetch(bridgeUrl(learnerId), {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ optIn: parsed.data.optIn }),
      signal: AbortSignal.timeout(serverEnv.AIVO_SERVICE_TIMEOUT_MS),
    });
    if (!res.ok) {
      return fail(
        { ...ERRORS.UPSTREAM_UNAVAILABLE, message: `brain-svc summer-bridge write failed (${res.status})` },
        requestId,
      );
    }
    const data = (await res.json()) as { optIn?: boolean; plansUpdated?: number };
    audit(session!, "summer_bridge.opt_in", requestId, {
      learnerId,
      metadata: { optIn: parsed.data.optIn, plansUpdated: data.plansUpdated ?? 0 },
    });
    return ok({ optIn: data.optIn === true, plansUpdated: data.plansUpdated ?? 0 }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
