import { NextResponse } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { pregenerateNextLessons } from "@/lib/learner/creator-pregenerate";

/**
 * Remediation Sprint 06 — the Creator's internal pre-generation endpoint.
 *
 * Called by admin-svc's `creator.weekly-generation` SafeCron (Sunday night,
 * fleet-leader-elected) — NOT by browsers. Auth is the shared
 * `INTERNAL_SERVICE_TOKEN` (`x-service-token`), the same service-to-service
 * seam the pacing/brain integrations use. The generation itself runs the
 * REAL production lesson path inside this web-v2 process, because the
 * generator and mission-selection logic live here and must not be forked
 * into a worker.
 */
const BodySchema = z
  .object({
    tenantIds: z.array(z.string().min(1)).min(1).max(50),
    limitPerTenant: z.number().int().min(1).max(5000).optional(),
  })
  .strict();

export const dynamic = "force-dynamic";

function tokenMatches(presented: string | null): boolean {
  const expected = serverEnv.INTERNAL_SERVICE_TOKEN;
  if (!expected || !presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    if (!serverEnv.INTERNAL_SERVICE_TOKEN) {
      return fail(
        {
          ...ERRORS.UPSTREAM_UNAVAILABLE,
          message:
            "Creator pre-generation requires INTERNAL_SERVICE_TOKEN to be configured " +
            "on web-v2 (service-to-service auth).",
        },
        requestId,
      );
    }
    if (!tokenMatches(req.headers.get("x-service-token"))) {
      return fail({ ...ERRORS.FORBIDDEN_ROLE, message: "invalid service token" }, requestId);
    }
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid body",
        },
        requestId,
      );
    }
    const result = await pregenerateNextLessons(parsed.data);
    return ok(result, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
