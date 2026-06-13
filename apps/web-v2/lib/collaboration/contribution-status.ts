/**
 * Sprint C-08 — team-hub contribution status (web BFF derivation).
 *
 * The canonical, mobile-shareable source of this data is family-svc's
 * `GET /api/family/collaboration/:learnerId/contributions`. The web-v2 parent
 * UI, however, reads from its own self-contained persistence layer
 * (`@/lib/db/persistence`) rather than calling family-svc over HTTP, so we
 * compose the IDENTICAL UI contract here from the web stores. (See the Sprint
 * C-08 Checkpoint: the endpoint landed in family-svc; the web hub derives the
 * same shape locally because the web app does not consume family-svc.)
 *
 * "Contributed" mirrors the family-svc rule, per role:
 *   - teacher:   a submitted teacher assessment (reuses C-07
 *                `hasTeacherContributed`, which checks assessment-svc with a
 *                local-draft fallback).
 *   - therapist: a collaborator insight authored by this therapist (the web
 *                stack captures therapist perspective as an insight pre-build).
 *   - caregiver: ≥1 caregiver observation authored by this caregiver, or a
 *                caregiver-authored insight.
 *
 * Server-only: do not import from client components.
 */
import type { LearnerCareTeam, TeamMemberRecord, TeamRole, InviteStatus } from "@/lib/db/team-invites";
import { getCareTeam } from "@/lib/db/team-invites";
import { hasTeacherContributed } from "@/lib/teacher/teacher-assessment-status";
import { getPersistence } from "@/lib/db/persistence";
import { listCaregiverObservations, listContributorAcknowledgements } from "@/lib/db/repos";
import type { ContributionFoldedItem } from "@/lib/db/types";

/** The per-member status the hub renders and the voices chip rolls up. The
 *  shape matches family-svc's contributions endpoint payload.
 *
 *  Sprint C-16 EXTENSION: `acknowledgedAt` carries the date this member's OWN
 *  folded input was acknowledged into an approved profile (null when they have
 *  not been acknowledged). This rides the SAME endpoint rather than a parallel
 *  one (per the sprint). It is privacy-safe at the member level: the parent (who
 *  reads this) is allowed to see whether each teammate's input has been
 *  acknowledged. The contributor-scoped surface (`getContributorSummary`) is the
 *  one that enforces own-items-only. */
export type MemberContributionStatus = {
  id: string;
  kind: TeamRole;
  displayName: string | null;
  email: string;
  status: InviteStatus;
  acceptedAt: string | null;
  contributed: boolean;
  lastContributionAt: string | null;
  resendable: boolean;
  /** C-16 — when this member's folded input was last acknowledged into an
   *  approved profile; null when never acknowledged. */
  acknowledgedAt: string | null;
};

export type ContributionsResult = {
  members: MemberContributionStatus[];
  voices: { invited: number; contributed: number };
};

function resendable(status: InviteStatus): boolean {
  return status === "PENDING" || status === "DECLINED";
}

async function therapistContribution(
  member: TeamMemberRecord,
  learnerId: string,
  tenantId: string,
): Promise<{ contributed: boolean; at: string | null }> {
  try {
    const insights = await getPersistence().collaboration.listInsightsForLearner(
      learnerId,
      tenantId,
    );
    const mine = insights.filter(
      (i) =>
        i.authorRole === "therapist" &&
        (member.memberUserId ? i.authorUserId === member.memberUserId : true),
    );
    if (mine.length === 0) return { contributed: false, at: null };
    const at = mine
      .map((i) => i.createdAt)
      .sort()
      .at(-1);
    return { contributed: true, at: at ?? null };
  } catch {
    return { contributed: false, at: null };
  }
}

async function caregiverContribution(
  member: TeamMemberRecord,
  learnerId: string,
  tenantId: string,
): Promise<{ contributed: boolean; at: string | null }> {
  // Observations are the primary caregiver signal; fall back to a
  // caregiver-authored insight (e.g. the pre-build perspective step).
  let latest: string | null = null;
  try {
    const obs = listCaregiverObservations(learnerId, tenantId, 200).filter(
      (o) => !member.memberUserId || o.caregiverUserId === member.memberUserId,
    );
    for (const o of obs) {
      const at = o.observedAt ?? o.createdAt;
      if (at && (!latest || at > latest)) latest = at;
    }
  } catch {
    /* observations unavailable in this mode */
  }
  if (!latest) {
    try {
      const insights = await getPersistence().collaboration.listInsightsForLearner(
        learnerId,
        tenantId,
      );
      const mine = insights.filter(
        (i) =>
          i.authorRole === "caregiver" &&
          (member.memberUserId ? i.authorUserId === member.memberUserId : true),
      );
      for (const i of mine) if (!latest || i.createdAt > latest) latest = i.createdAt;
    } catch {
      /* insights unavailable */
    }
  }
  return { contributed: latest != null, at: latest };
}

async function statusFor(
  role: TeamRole,
  member: TeamMemberRecord,
  learnerId: string,
  tenantId: string,
  acknowledgedAtByEmail: Map<string, string>,
): Promise<MemberContributionStatus> {
  let contributed = false;
  let lastContributionAt: string | null = null;

  if (role === "teacher") {
    // C-07 source of truth. The teacher contribution isn't per-row dated in
    // the web stack, so we surface the acceptance as the best-available
    // "since" — the badge state is what the parent acts on.
    if (member.memberUserId) {
      contributed = await hasTeacherContributed(learnerId, tenantId, member.memberUserId);
    }
    if (contributed) lastContributionAt = member.acceptedAt;
  } else if (role === "therapist") {
    const r = await therapistContribution(member, learnerId, tenantId);
    contributed = r.contributed;
    lastContributionAt = r.at;
  } else {
    const r = await caregiverContribution(member, learnerId, tenantId);
    contributed = r.contributed;
    lastContributionAt = r.at;
  }

  return {
    id: member.id,
    kind: role,
    displayName: null,
    email: member.email,
    status: member.status,
    acceptedAt: member.acceptedAt,
    contributed,
    lastContributionAt,
    resendable: resendable(member.status),
    acknowledgedAt: acknowledgedAtByEmail.get(member.email.trim().toLowerCase()) ?? null,
  };
}

/**
 * Compose the per-member contribution status for the team hub + the voices
 * chip. Pass a pre-fetched care team to avoid a duplicate read, or omit it to
 * fetch here.
 */
export async function getContributionStatus(
  learnerId: string,
  tenantId: string,
  careTeam?: LearnerCareTeam,
): Promise<ContributionsResult> {
  const team = careTeam ?? (await getCareTeam(learnerId, tenantId));
  // C-16 — most-recent acknowledgement per contributor email (newest-first from
  // the store, so the first seen per email is the latest).
  const acks = await getPersistence().contributionAcknowledgements.listForLearner(
    learnerId,
    tenantId,
  );
  const acknowledgedAtByEmail = new Map<string, string>();
  for (const a of acks) {
    const key = a.contributorEmail.trim().toLowerCase();
    if (!acknowledgedAtByEmail.has(key)) acknowledgedAtByEmail.set(key, a.acknowledgedAt);
  }
  const byRole: [TeamRole, TeamMemberRecord[]][] = [
    ["teacher", team.teachers],
    ["caregiver", team.caregivers],
    ["therapist", team.therapists],
  ];
  const members = await Promise.all(
    byRole.flatMap(([role, list]) =>
      list.map((m) => statusFor(role, m, learnerId, tenantId, acknowledgedAtByEmail)),
    ),
  );
  // Invited = every non-revoked member; contributed = those with a landed
  // contribution. (getCareTeam already excludes revoked, so all are live.)
  const live = members.filter((m) => m.status !== "REVOKED");
  return {
    members,
    voices: {
      invited: live.length,
      contributed: live.filter((m) => m.contributed).length,
    },
  };
}

// ─── Sprint C-16: the contributor-scoped "Your contributions" summary ───────
//
// This is the CONTRIBUTOR's own view (not the parent's hub view). It returns,
// for ONE contributor on ONE learner, the three states the summary card renders:
//
//   never_contributed       — they've shared nothing yet (gentle invite).
//   contributed_pending     — they've shared, the family hasn't approved yet
//                             ("shared — the family is reviewing").
//   acknowledged            — their OWN input is folded into the active,
//                             approved profile (the warm, dated confirmation).
//
// PRIVACY (the sprint's central trust rule): the `foldedItems` returned are ONLY
// this contributor's own — derived from the acknowledgement record keyed to
// their account/email. We never return another contributor's content, the
// child's levels/diagnoses, or parent-private data. The caller (the BFF) has
// already authenticated the contributor as themselves; this function is scoped
// by (contributorUserId | email), so it is structurally incapable of returning
// another contributor's items.

export type ContributorSummaryState =
  | "never_contributed"
  | "contributed_pending"
  | "acknowledged";

export type ContributorLearnerSummary = {
  learnerId: string;
  /** The learner's first name — the only learner datum surfaced. */
  learnerFirstName: string;
  role: TeamRole;
  state: ContributorSummaryState;
  /** True once this contributor has any landed contribution of their kind. */
  contributed: boolean;
  /** ISO timestamp of their most recent contribution, or null. */
  lastContributionAt: string | null;
  /** ISO timestamp their OWN input was acknowledged into an approved profile;
   *  null when not yet acknowledged. */
  acknowledgedAt: string | null;
  /** Their OWN folded items (label + reasoning). Empty until acknowledged. */
  foldedItems: ContributionFoldedItem[];
};

/**
 * Compose the contributor's own per-learner summary. `member` is THIS
 * contributor's care-team row for the learner (so we reuse the same per-role
 * "contributed" predicate the hub uses). Returns own-items-only by construction.
 */
export async function getContributorSummary(opts: {
  role: TeamRole;
  member: TeamMemberRecord;
  learnerId: string;
  learnerFirstName: string;
  tenantId: string;
  contributorUserId: string | null;
  contributorEmail: string;
}): Promise<ContributorLearnerSummary> {
  const { role, member, learnerId, learnerFirstName, tenantId, contributorUserId, contributorEmail } =
    opts;

  // Reuse the hub's per-role contribution predicate (own items only — statusFor
  // matches by this member's user id / email).
  const status = await statusFor(role, member, learnerId, tenantId, new Map());

  // The contributor's OWN acknowledgements for this learner (newest-first).
  const acks = await listContributorAcknowledgements({
    tenantId,
    contributorUserId,
    contributorEmail,
    learnerId,
  });
  const latestAck = acks[0] ?? null;

  let state: ContributorSummaryState;
  if (latestAck) {
    state = "acknowledged";
  } else if (status.contributed) {
    state = "contributed_pending";
  } else {
    state = "never_contributed";
  }

  return {
    learnerId,
    learnerFirstName,
    role,
    state,
    contributed: status.contributed,
    lastContributionAt: status.lastContributionAt,
    acknowledgedAt: latestAck?.acknowledgedAt ?? null,
    foldedItems: latestAck?.foldedItems ?? [],
  };
}
