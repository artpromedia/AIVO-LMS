/**
 * Sprint 24: consent enforcement for under-13 learner data routes.
 *
 * The guard is a no-op when no AgeGateRecord exists or the learner is not
 * flagged `requiresParentConsent` (i.e. 13+). For under-13 learners every
 * provided consentType must have an active, non-revoked ConsentRecord
 * (per-learner first, then account-wide as fallback) belonging to the
 * parent-of-record — regardless of which role is making the request. A
 * learner's own action on her own data is still blocked if the parent has
 * not granted (or has revoked) the required consent.
 */
import { createHash } from "node:crypto";
import { fail } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import type { NextResponse } from "next/server";
import type { BffFailure } from "@/lib/bff/response";
import type { SessionProfile } from "@/lib/auth/types";
import type { ConsentType } from "@/lib/db/types";
import {
  findPrimaryParentForLearner,
  getActiveConsentForUser,
  getAgeGateForLearner,
} from "@/lib/db/repos";

export function requireLearnerConsent(
  session: SessionProfile,
  learnerId: string,
  consentTypes: ConsentType[],
  requestId: string,
): NextResponse<BffFailure> | null {
  const ageGate = getAgeGateForLearner(learnerId, session.tenantId);
  if (!ageGate || !ageGate.requiresParentConsent) return null;
  const parentUserId = findPrimaryParentForLearner(learnerId, session.tenantId);
  if (!parentUserId) {
    return fail(
      {
        ...ERRORS.PRECONDITION_FAILED,
        message: "No parent of record for this under-13 learner.",
      },
      requestId,
    );
  }
  for (const type of consentTypes) {
    const perLearner = getActiveConsentForUser(
      parentUserId,
      type,
      session.tenantId,
      learnerId,
    );
    const account = getActiveConsentForUser(
      parentUserId,
      type,
      session.tenantId,
      null,
    );
    if (!perLearner && !account) {
      return fail(
        {
          ...ERRORS.PRECONDITION_FAILED,
          message: `Parent consent for ${type} is required before this action.`,
        },
        requestId,
      );
    }
  }
  return null;
}

/**
 * Boolean variant of `requireLearnerConsent` for server actions, which redirect
 * instead of returning a BFF response. Returns true when every consentType is
 * satisfied (or no age-gate / not under-13), false when any required consent
 * is missing or revoked.
 */
export function hasLearnerConsent(
  tenantId: string,
  learnerId: string,
  consentTypes: ConsentType[],
): boolean {
  const ageGate = getAgeGateForLearner(learnerId, tenantId);
  if (!ageGate || !ageGate.requiresParentConsent) return true;
  const parentUserId = findPrimaryParentForLearner(learnerId, tenantId);
  if (!parentUserId) return false;
  for (const type of consentTypes) {
    const perLearner = getActiveConsentForUser(parentUserId, type, tenantId, learnerId);
    const account = getActiveConsentForUser(parentUserId, type, tenantId, null);
    if (!perLearner && !account) return false;
  }
  return true;
}

/** Hash a client IP for consent evidence without persisting the raw value. */
export function hashIpFromRequest(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0]!.trim() : null;
  if (!ip) return null;
  return createHash("sha256")
    .update(ip + ":" + (process.env.IP_HASH_SALT ?? "aivo-consent-v1"))
    .digest("hex")
    .slice(0, 32);
}
