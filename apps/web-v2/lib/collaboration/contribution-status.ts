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
import { listCaregiverObservations } from "@/lib/db/repos";

/** The per-member status the hub renders and the voices chip rolls up. The
 *  shape matches family-svc's contributions endpoint payload. */
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
  const byRole: [TeamRole, TeamMemberRecord[]][] = [
    ["teacher", team.teachers],
    ["caregiver", team.caregivers],
    ["therapist", team.therapists],
  ];
  const members = await Promise.all(
    byRole.flatMap(([role, list]) =>
      list.map((m) => statusFor(role, m, learnerId, tenantId)),
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
