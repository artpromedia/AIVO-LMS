/**
 * Cross-platform learner unification (Task #34).
 *
 * Server-only. Bridges the web app's own `lrn_*` learner profiles with the
 * canonical identity-svc `learners.id` (UUID) that the backend microservices
 * and the mobile app key off, so a learner enrolled on either platform shows
 * up — and stays in sync — on both under the same parent account.
 *
 * Two directions, both best-effort (a failure here must never break the
 * parent's learner list or learner creation):
 *
 *  - web → identity ("provision + link"): a web-enrolled learner is created
 *    in identity-svc and the returned UUID is stored on the web profile. This
 *    also backfills pre-existing web-only learners the next time the parent
 *    loads the app.
 *  - identity → web ("surface"): a learner that already exists in identity-svc
 *    (e.g. enrolled from mobile) but has no linked web profile gets a minimal
 *    web profile materialized so it appears in the web dashboards.
 *
 * Browser code MUST NOT import this module — it reads the user's access token.
 */
import { getPersistence } from "@/lib/db/persistence";
import {
  isIdentitySvcEnabled,
  createLearnerViaIdentity,
  listLearnersViaIdentity,
  type IdentityLearner,
} from "@/lib/bff/identity-learners";
import type { LearnerProfile } from "@/lib/db/types";

type LogFn = (event: string, data: Record<string, unknown>) => void;

/** Best-effort birth year for a mobile-origin learner: parse identity DOB,
 *  else a neutral placeholder the parent can correct in the web profile. */
function birthYearFromDob(dob: string | null | undefined): number {
  if (dob) {
    const year = new Date(dob).getFullYear();
    if (Number.isFinite(year) && year >= 1990) return year;
  }
  return new Date().getFullYear() - 8;
}

/**
 * Provision a single web learner in identity-svc and persist the link.
 * No-op (returns the learner unchanged) when already linked. Returns the
 * learner with `identityLearnerId` populated on success, or the original on
 * any failure (logged, never thrown).
 */
export async function provisionAndLink(
  bearer: string,
  learner: LearnerProfile,
  tenantId: string,
  log?: LogFn,
): Promise<LearnerProfile> {
  if (learner.identityLearnerId) return learner;
  const res = await createLearnerViaIdentity(bearer, {
    name: learner.displayName?.trim() || learner.firstName.trim(),
    gradeLevel: learner.gradeBand ?? undefined,
    preferredLanguage: learner.primaryLanguage ?? undefined,
    zipCode: learner.zipCode ?? undefined,
  });
  if (!res.ok) {
    log?.("learner_unification.provision_failed", {
      learnerId: learner.id,
      status: res.status,
      error: res.error,
    });
    return learner;
  }
  const uuid = res.data.learner?.id;
  if (!uuid) {
    log?.("learner_unification.provision_no_id", { learnerId: learner.id });
    return learner;
  }
  const updated = await getPersistence().learners.setIdentityLink(learner.id, tenantId, uuid);
  return updated ?? { ...learner, identityLearnerId: uuid };
}

/**
 * Reconcile a parent's learners across both platforms. Backfills missing
 * web → identity links, then surfaces any identity-only (e.g. mobile-origin)
 * learners as web profiles. Best-effort and idempotent: safe to call on every
 * learner-list read. No-op when identity-svc is disabled or no bearer is
 * available (dev / mock mode keeps using the in-memory path).
 */
export async function reconcileLearnersForParent(opts: {
  parentUserId: string;
  tenantId: string;
  bearer: string | null;
  log?: LogFn;
}): Promise<void> {
  const { parentUserId, tenantId, bearer, log } = opts;
  if (!bearer || !isIdentitySvcEnabled()) return;

  const learners = getPersistence().learners;
  let webLearners: LearnerProfile[];
  let identityList: IdentityLearner[];
  try {
    const [web, identityRes] = await Promise.all([
      learners.listForParent(parentUserId, tenantId),
      listLearnersViaIdentity(bearer),
    ]);
    if (!identityRes.ok) {
      log?.("learner_unification.identity_list_failed", {
        status: identityRes.status,
        error: identityRes.error,
      });
      return;
    }
    webLearners = web;
    identityList = Array.isArray(identityRes.data) ? identityRes.data : [];
  } catch (err) {
    log?.("learner_unification.reconcile_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  const linkedIds = new Set<string>();
  for (const l of webLearners) {
    if (l.identityLearnerId) linkedIds.add(l.identityLearnerId);
  }

  // web → identity: backfill links for web-only learners.
  for (const l of webLearners) {
    if (l.identityLearnerId) continue;
    const linked = await provisionAndLink(bearer, l, tenantId, log);
    if (linked.identityLearnerId) linkedIds.add(linked.identityLearnerId);
  }

  // identity → web: surface identity-only learners as web profiles.
  for (const il of identityList) {
    if (!il?.id || linkedIds.has(il.id)) continue;
    try {
      await learners.createFromIdentity({
        tenantId,
        parentUserId,
        identityLearnerId: il.id,
        name: il.name?.trim() || "Learner",
        birthYear: birthYearFromDob(il.dateOfBirth),
        primaryLanguage: null,
      });
      linkedIds.add(il.id);
    } catch (err) {
      log?.("learner_unification.surface_failed", {
        identityLearnerId: il.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
