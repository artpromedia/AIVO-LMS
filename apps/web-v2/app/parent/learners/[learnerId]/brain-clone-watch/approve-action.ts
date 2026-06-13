/**
 * Sprint C-06 — the testable core of the approval ceremony's server action.
 *
 * The page's `approveBrainCloneAction` is a thin Next server action (session +
 * `parentCanAccessLearner` + redirects); the actual trust gate and record
 * write live here so they can be proven by unit tests without booting Next's
 * redirect machinery. A forged POST that omits consent or RAI acknowledgement
 * is REJECTED here (defense-in-depth, same philosophy as brain-svc's approve
 * handler) — never merely disabled in the UI.
 *
 * On success it folds any C-05 staged corrections (via `approveBrainClone`,
 * which reads the staged draft), then writes the dedicated approval record
 * (actor, action, consent + RAI versions, the reviewed profile revision, the
 * folded modifications, and the hashed request IP).
 */
import {
  approveBrainClone,
  getBrainProfile,
  recordBrainApproval,
} from "@/lib/db/repos";
import type { BrainProfileApproval, LearnerBrainProfile } from "@/lib/db/types";

/** COPPA consent copy version recorded with each approval (mirrors brain-svc's
 *  `consent_version` default — bump when the consent wording changes). */
export const BRAIN_CONSENT_VERSION = "1.0";

export type PerformBrainApprovalInput = {
  tenantId: string;
  actorUserId: string;
  learnerId: string;
  consentGiven: boolean;
  raiAcknowledged: boolean;
  /** Client-pinned versions; both fall back to safe defaults when absent. */
  consentVersion?: string | null;
  raiVersion?: string | null;
  ipHash: string | null;
};

export type PerformBrainApprovalResult =
  | { ok: false; reason: "consent_missing" | "rai_missing" | "no_clone" }
  | { ok: true; profile: LearnerBrainProfile; record: BrainProfileApproval };

export async function performBrainApproval(
  input: PerformBrainApprovalInput,
): Promise<PerformBrainApprovalResult> {
  // 1) Trust gate (server-side; a forged POST without either field is rejected
  //    here, not just disabled in the UI).
  if (!input.consentGiven) return { ok: false, reason: "consent_missing" };
  if (!input.raiAcknowledged) return { ok: false, reason: "rai_missing" };

  // 2) The revision the parent reviewed — read BEFORE approving, since folding
  //    corrections advances the revision. Pinned into the record so it names
  //    the exact profile they acted on.
  const reviewed = await getBrainProfile(input.learnerId, input.tenantId);
  if (!reviewed || reviewed.cloneStage === "pre_clone") return { ok: false, reason: "no_clone" };
  const reviewedRevision = reviewed.revision;

  // 3) Fold any C-05 staged corrections (approveBrainClone reads the staged
  //    draft — pass nothing so it never double-collects). Idempotent.
  const profile = await approveBrainClone(input.learnerId, input.tenantId, {});
  if (!profile) return { ok: false, reason: "no_clone" };

  const consentVersion =
    (input.consentVersion && input.consentVersion.length > 0
      ? input.consentVersion
      : BRAIN_CONSENT_VERSION);
  // RAI version defaults to the reviewed revision (mirrors brain-svc semantics).
  const raiVersion =
    input.raiVersion && input.raiVersion.length > 0
      ? input.raiVersion
      : String(reviewedRevision);

  // 4) Write the dedicated approval record.
  const record = await recordBrainApproval({
    tenantId: input.tenantId,
    learnerId: input.learnerId,
    brainProfileId: profile.id,
    profileRevision: reviewedRevision,
    actorUserId: input.actorUserId,
    action: profile.approvalStatus === "amended" ? "amended" : "approved",
    consentVersion,
    raiVersion,
    modifications: profile.state.xaiExplanation.parentModifications ?? [],
    ipHash: input.ipHash,
  });

  return { ok: true, profile, record };
}
