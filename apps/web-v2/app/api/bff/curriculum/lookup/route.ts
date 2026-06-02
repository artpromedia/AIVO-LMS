import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * GET /api/bff/curriculum/lookup?zipCode=…
 *
 * Thin proxy to identity-svc's curriculum + zip→district endpoints.
 * Returns the dominant district plus alternates in one payload so the
 * `<ZipDistrictField>` client component can render the auto-fill and
 * the "Not your district?" override without a second round-trip.
 *
 * No auth required — the parent enters their own zip during signup or
 * learner add. The response is non-PII (public NCES data).
 */
export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const url = new URL(req.url);
  const zipCode = (url.searchParams.get("zipCode") ?? "").trim();
  const country = url.searchParams.get("country") ?? undefined;

  if (!zipCode && !country) {
    return fail(
      {
        code: "invalid_input",
        message: "zipCode or country is required",
        userMessage: "Please enter a zip code or country.",
        retryable: false,
        status: 400,
      },
      requestId,
    );
  }

  try {
    const params = new URLSearchParams();
    if (zipCode) params.set("zipCode", zipCode);
    if (country) params.set("country", country);

    const [curriculumRes, districtsRes] = await Promise.all([
      fetch(`${serverEnv.IDENTITY_SVC_URL}/api/curriculum/lookup?${params.toString()}`, {
        signal: AbortSignal.timeout(3000),
      }),
      zipCode
        ? fetch(
            `${serverEnv.IDENTITY_SVC_URL}/api/curriculum/districts/by-zip?zipCode=${encodeURIComponent(zipCode)}`,
            { signal: AbortSignal.timeout(3000) },
          )
        : Promise.resolve(null),
    ]);

    if (!curriculumRes.ok) {
      return fail(
        {
          code: "identity_svc_error",
          message: `identity-svc returned ${curriculumRes.status}`,
          userMessage: "We couldn't look up that zip code right now.",
          retryable: true,
          status: 502,
        },
        requestId,
      );
    }

    const curriculum = await curriculumRes.json();
    const districts = districtsRes && districtsRes.ok ? await districtsRes.json() : null;

    return ok(
      {
        curriculum,
        districts,
      },
      requestId,
    );
  } catch (err) {
    return failFromUnknown(err, requestId);
  }
}
