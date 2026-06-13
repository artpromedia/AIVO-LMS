/**
 * Sprint C-16 — server-side dispatch of the contributor acknowledgement EMAIL
 * to comms-svc's role-aware template route.
 *
 * The in-app notification + per-channel preference gating is handled web-side by
 * `createNotification` (repos.ts). This helper adds the WARM, role-aware email
 * body rendered by comms-svc's `contribution_acknowledged_{teacher|caregiver|
 * therapist}` templates — the same internal-key pattern family-svc uses for its
 * `team-invite` dispatch. Best-effort: a delivery failure never blocks the
 * approval that triggered it (the acknowledgement record is already durable; the
 * summary card surfaces it regardless of email).
 *
 * PRIVACY: the payload carries ONLY the contributor's own folded items
 * (label + their reasoning snippet) + the learner's first name — never another
 * contributor's content, never the child's levels/diagnoses. The route + the
 * template both re-assert this (content-safety tested).
 *
 * Server-only: never import from a client component.
 */
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/observability/logger";
import type { ContributionFoldedItem, ContributionRole } from "@/lib/db/types";

export type ContributionAckEmailInput = {
  to: string;
  role: ContributionRole;
  learnerFirstName: string;
  foldedItems: ContributionFoldedItem[];
  /** Where the CTA lands the contributor (their "Your contributions" surface). */
  contributionsUrl: string;
  /** Where the unsubscribe link routes (their notification preferences). */
  unsubscribeUrl: string;
};

function internalKey(): string {
  return (
    process.env.INTERNAL_SERVICE_KEY ||
    (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key")
  );
}

/**
 * POST the acknowledgement to comms-svc's role-aware template route. Returns
 * `true` when comms-svc accepted it (status sent/queued/dev_mode), `false` on
 * any failure — the caller treats `false` as "email not delivered" but never
 * throws. A missing internal key in dev still attempts the call with the dev
 * default; in production a missing key short-circuits to `false` (logged).
 */
export async function dispatchContributionAckEmail(
  input: ContributionAckEmailInput,
): Promise<boolean> {
  const key = internalKey();
  if (!key) {
    logger.warn(
      { event: "contribution_ack.email.no_internal_key" },
      "[contribution-ack] no INTERNAL_SERVICE_KEY — skipping email dispatch",
    );
    return false;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), serverEnv.AIVO_SERVICE_TIMEOUT_MS);
  try {
    const res = await fetch(`${serverEnv.COMMS_SVC_URL}/api/comms/internal/contribution-acknowledged`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": key },
      body: JSON.stringify({
        to: input.to,
        role: input.role,
        learnerFirstName: input.learnerFirstName,
        // Only label + reasoning cross the wire — privacy-safe (see module doc).
        items: input.foldedItems.map((i) => ({ label: i.label, reasoning: i.reasoning })),
        contributionsUrl: input.contributionsUrl,
        unsubscribeUrl: input.unsubscribeUrl,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn(
        { event: "contribution_ack.email.non_2xx", status: res.status, role: input.role },
        "[contribution-ack] comms-svc returned non-2xx",
      );
      return false;
    }
    return true;
  } catch (err) {
    logger.warn(
      {
        event: "contribution_ack.email.failed",
        role: input.role,
        message: err instanceof Error ? err.message : String(err),
      },
      "[contribution-ack] comms-svc email dispatch failed",
    );
    return false;
  } finally {
    clearTimeout(timer);
  }
}
