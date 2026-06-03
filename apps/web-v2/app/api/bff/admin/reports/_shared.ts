import type { NextResponse } from "next/server";
import type { SessionProfile } from "@/lib/auth/types";
import type { ServiceCallFailure } from "@/lib/services/client";

export const REPORTS_ROLES = ["platform_admin", "district_admin", "school_admin"] as const;

/** Forward the actor scope to reports-svc as the headers it expects. */
export function reportsAuthHeaders(session: SessionProfile): Record<string, string> {
  return {
    "x-actor-role": session.role,
    "x-tenant-id": session.tenantId,
    "x-actor-id": session.userId,
  };
}

type FailFn = (
  args: {
    code: string;
    message: string;
    userMessage: string;
    retryable?: boolean;
    status?: number;
  },
  requestId: string,
) => NextResponse;

function codeForStatus(status: number | null): string {
  switch (status) {
    case 400:
      return "VALIDATION_FAILED";
    case 401:
      return "UNAUTHENTICATED";
    case 403:
      return "FORBIDDEN_ROLE";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 429:
      return "RATE_LIMITED";
    default:
      if (status && status >= 500) return "UPSTREAM_UNAVAILABLE";
      return "UPSTREAM_UNAVAILABLE";
  }
}

function userMessageForStatus(status: number | null): string {
  switch (status) {
    case 400:
      return "Some details look off. Check the form and try again.";
    case 403:
      return "You don't have access to that report.";
    case 404:
      return "We couldn't find what you were looking for.";
    case 429:
      return "You've reached the report quota. Please wait and try again.";
    default:
      return "The reports service is unavailable. Please try again shortly.";
  }
}

/**
 * Map a reports-svc non-2xx failure into a BFF fail response, preserving the
 * upstream HTTP status (e.g. 429 quota, 400 invalid params, 403 forbidden).
 * Attempts to surface an upstream `code` from the error body when present.
 */
export function upstreamFail(
  res: ServiceCallFailure,
  requestId: string,
  fail: FailFn,
): NextResponse {
  const status = res.status ?? 502;
  let code = codeForStatus(res.status);
  try {
    const parsed = JSON.parse(res.message);
    const upstreamCode = parsed?.error?.code ?? parsed?.code;
    if (typeof upstreamCode === "string" && upstreamCode) code = upstreamCode;
  } catch {
    /* message is not JSON — keep the status-derived code */
  }
  return fail(
    {
      code,
      message: res.message || `Upstream HTTP ${status}`,
      userMessage: userMessageForStatus(res.status),
      retryable: status === 429 || status >= 500,
      status,
    },
    requestId,
  );
}
