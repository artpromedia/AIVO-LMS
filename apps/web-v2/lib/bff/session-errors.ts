import { fail } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import type { SessionMutationResult } from "@/lib/db/repos";

type FailResult = Extract<SessionMutationResult, { ok: false }>;

/** Map a session repo failure code to the matching BFF error envelope. */
export function failSession(result: FailResult, requestId: string) {
  const base = {
    forbidden: ERRORS.FORBIDDEN_LEARNER,
    not_assigned: ERRORS.VALIDATION_FAILED,
    unavailable: ERRORS.PRECONDITION_FAILED,
    conflict: ERRORS.CONFLICT,
    not_found: ERRORS.NOT_FOUND,
    invalid: ERRORS.VALIDATION_FAILED,
  }[result.code];
  return fail({ ...base, message: result.error }, requestId);
}
