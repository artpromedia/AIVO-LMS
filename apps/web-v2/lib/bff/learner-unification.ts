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

/** Context used to recover from a prior partial failure (identity learner
 *  created, link-write failed) instead of creating a duplicate. `candidates`
 *  is the parent's identity-svc learners; `linkedIds` is the set of identity
 *  UUIDs already linked to a web profile (mutated as matches are consumed). */
type ReuseContext = { candidates: IdentityLearner[]; linkedIds: Set<string> };

function normName(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** A usable birth year from an identity-svc DOB string, else null. */
function dobYear(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const y = new Date(dob).getFullYear();
  return Number.isFinite(y) ? y : null;
}

/** Build the reuse context for a standalone `provisionAndLink` call (the PIN
 *  path) by reading the parent's web + identity learners. Returns null when
 *  the identity list is unavailable (so we skip reuse and fall through). */
async function buildReuseContext(
  bearer: string,
  parentUserId: string,
  tenantId: string,
  log?: LogFn,
): Promise<ReuseContext | null> {
  try {
    const learners = getPersistence().learners;
    const [web, listRes] = await Promise.all([
      learners.listForParent(parentUserId, tenantId),
      listLearnersViaIdentity(bearer),
    ]);
    if (!listRes.ok) {
      log?.("learner_unification.identity_list_failed", {
        status: listRes.status,
        error: listRes.error,
      });
      return null;
    }
    const linkedIds = new Set<string>();
    for (const l of web) if (l.identityLearnerId) linkedIds.add(l.identityLearnerId);
    return {
      candidates: Array.isArray(listRes.data) ? listRes.data : [],
      linkedIds,
    };
  } catch (err) {
    log?.("learner_unification.reuse_context_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Find an unlinked identity learner that matches this web learner by name —
 *  i.e. an orphan left by a prior attempt whose link-write failed, or a
 *  same-named mobile-origin learner that is in fact the same child. Matching by
 *  name (within one parent's roster) can in theory mis-pair two different
 *  same-named children, but that risk is far cheaper than minting a duplicate
 *  canonical identity on every retry. */
function findReusableIdentityLearner(
  learner: LearnerProfile,
  ctx: ReuseContext,
): IdentityLearner | undefined {
  const target = normName(learner.displayName) || normName(learner.firstName);
  if (!target) return undefined;
  return ctx.candidates.find((c) => {
    if (!c?.id || ctx.linkedIds.has(c.id) || normName(c.name) !== target) return false;
    // Narrow same-name matches with birth year when the candidate carries a
    // DOB, so two same-named siblings under one parent aren't mis-paired. The
    // orphans we created via createLearnerViaIdentity carry no DOB, so they
    // still match on name alone (the partial-failure recovery case).
    const cy = dobYear(c.dateOfBirth);
    return cy === null || cy === learner.birthYear;
  });
}

/**
 * Provision a single web learner in identity-svc and persist the link.
 * No-op (returns the learner unchanged) when already linked.
 *
 * Idempotent across retries / partial failure: before creating a canonical
 * learner it looks for an existing unlinked identity learner to reuse (recovers
 * the case where a prior attempt created the identity learner but failed to
 * persist the link, which would otherwise mint a duplicate on the next reconcile
 * or PIN-set). Callers inside a reconcile loop pass a shared `reuse` context so
 * the list is fetched once and matches are not double-assigned; standalone
 * callers (PIN) let it build its own.
 *
 * Returns the learner with `identityLearnerId` populated on success, or the
 * original on any failure (logged, never thrown).
 */
export async function provisionAndLink(
  bearer: string,
  learner: LearnerProfile,
  tenantId: string,
  opts?: { parentUserId?: string; log?: LogFn; reuse?: ReuseContext },
): Promise<LearnerProfile> {
  const log = opts?.log;
  if (learner.identityLearnerId) return learner;

  // Partial-failure recovery: reuse an orphaned identity learner rather than
  // creating a duplicate canonical learner. The reconcile loop passes a shared
  // context; a standalone caller (PIN) supplies the parent id so we can build
  // one (without it we cannot tell orphans from already-linked learners, so we
  // skip reuse and create — the rarer first-PIN-before-list case).
  const ctx =
    opts?.reuse ??
    (opts?.parentUserId
      ? await buildReuseContext(bearer, opts.parentUserId, tenantId, log)
      : null);
  if (ctx) {
    const match = findReusableIdentityLearner(learner, ctx);
    if (match?.id) {
      ctx.linkedIds.add(match.id); // consume so a later iteration can't reuse it
      const updated = await getPersistence().learners.setIdentityLink(
        learner.id,
        tenantId,
        match.id,
      );
      log?.("learner_unification.reused_identity", {
        learnerId: learner.id,
        identityLearnerId: match.id,
      });
      return updated ?? { ...learner, identityLearnerId: match.id };
    }
  }

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
  // Track the freshly created id so a shared reuse context (reconcile loop)
  // won't re-create or re-surface it later in the same pass.
  ctx?.linkedIds.add(uuid);
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

  // web → identity: backfill links for web-only learners. Share one reuse
  // context (the identity list we already fetched + the running linkedIds set)
  // so a single list read serves the whole pass, orphaned identity learners
  // are reused instead of duplicated, and the surfacing pass below skips
  // anything we just linked.
  const reuse: ReuseContext = { candidates: identityList, linkedIds };
  for (const l of webLearners) {
    if (l.identityLearnerId) continue;
    const linked = await provisionAndLink(bearer, l, tenantId, { log, reuse });
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
