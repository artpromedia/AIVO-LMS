"use server";

import { serverEnv } from "@/lib/env";

export type OptOutResult = { ok: boolean };

/**
 * Sprint C-08 — turn off contribution-nudge reminders for one invite.
 *
 * Called from the unsubscribe landing page (the link in the nudge email). The
 * recipient may not be signed in, so we authorize server-side with the
 * internal service key and treat the invite id from the link as the intent
 * token. Idempotent and only ever turns reminders OFF — the worst a forged id
 * can do is silence a nudge, never read or change learner data.
 */
export async function optOutOfNudgesAction(kind: string, inviteId: string): Promise<OptOutResult> {
  if (!["teacher", "caregiver", "therapist"].includes(kind) || !inviteId) {
    return { ok: false };
  }
  const base = serverEnv.FAMILY_SVC_URL.replace(/\/$/, "");
  const key =
    process.env.INTERNAL_SERVICE_KEY ||
    (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
  if (!key) return { ok: false };
  try {
    const res = await fetch(
      `${base}/api/family/collaboration/invites/${encodeURIComponent(kind)}/${encodeURIComponent(
        inviteId,
      )}/contribution-opt-out`,
      { method: "POST", headers: { "x-internal-key": key }, cache: "no-store" },
    );
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
