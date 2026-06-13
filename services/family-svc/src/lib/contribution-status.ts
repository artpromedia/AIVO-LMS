/**
 * Sprint C-08 — per-member contribution-status derivation (pure).
 *
 * The team-hub answers one question for the parent about every invited
 * teammate: where are they on the path invited → accepted → contributed?
 * "Contributed" is role-specific:
 *   - teacher:   a completed `teacher_assessments` row exists for the learner
 *                that this teacher submitted (or, if attribution is absent,
 *                ANY completed teacher assessment — see note below).
 *   - therapist: a completed `therapist_assessments` row this therapist
 *                submitted (same attribution fallback).
 *   - caregiver: at least one `caregiver_observations` row this caregiver
 *                authored.
 *
 * This module is intentionally pure (no DB, no fetch) so the route can unit
 * test the derivation against fixture rows and the comms-svc reminder job can
 * reuse the identical predicate without standing up a server.
 */

export type MemberKind = "teacher" | "caregiver" | "therapist";

export type InviteStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED";

/** A care-team member row as the hub needs it, normalised across the three
 *  per-role tables. */
export interface MemberInput {
  id: string;
  kind: MemberKind;
  /** Lowercased invitee email. */
  email: string;
  /** Resolved display name (falls back to email locally in the route). */
  displayName: string | null;
  status: InviteStatus;
  acceptedAt: Date | null;
  /** The accepted member's user id, once they have one. */
  memberUserId: string | null;
}

/** A completed contribution signal, keyed to the contributor. A row is only
 *  a "contribution" when it is completed (completedAt set) for assessments,
 *  or simply present for observations. */
export interface ContributionSignal {
  kind: MemberKind;
  /** The user id credited with the contribution (submittedBy / author). */
  contributorUserId: string | null;
  /** When the contribution last landed. */
  at: Date;
}

export interface MemberContributionStatus {
  id: string;
  kind: MemberKind;
  displayName: string | null;
  email: string;
  status: InviteStatus;
  acceptedAt: string | null;
  /** True once this member has a completed contribution of their kind. */
  contributed: boolean;
  /** ISO timestamp of the member's most recent contribution, or null. */
  lastContributionAt: string | null;
  /** A pending/declined member can be resent; accepted/revoked cannot. */
  resendable: boolean;
  /** Sprint C-16 — ISO timestamp this member's OWN folded input was last
   *  acknowledged into an approved profile; null when never acknowledged.
   *  Rides this endpoint (not a parallel one). */
  acknowledgedAt: string | null;
}

function iso(d: Date | null): string | null {
  return d ? new Date(d).toISOString() : null;
}

/**
 * Match a contribution to a member. We credit a member when the contribution
 * was authored by that member's user id. When a signal carries no author
 * (legacy rows predate submitted_by), we fall back to crediting it to ANY
 * accepted member of the same kind — the parent-facing promise is "did a
 * {teacher} contribute", and a single seat per kind (teacher/therapist) makes
 * this unambiguous; caregivers (2 seats) only credit on an explicit author
 * match so we never over-claim one caregiver's note for the other.
 */
function signalsForMember(
  member: MemberInput,
  signals: ContributionSignal[],
): ContributionSignal[] {
  const sameKind = signals.filter((s) => s.kind === member.kind);
  return sameKind.filter((s) => {
    if (s.contributorUserId && member.memberUserId) {
      return s.contributorUserId === member.memberUserId;
    }
    // Unattributed signal: credit only for single-seat kinds, never caregiver.
    return s.contributorUserId == null && member.kind !== "caregiver";
  });
}

export function deriveContributionStatus(
  members: MemberInput[],
  signals: ContributionSignal[],
  /** Sprint C-16 — most-recent acknowledgement ISO per lowercased contributor
   *  email. Members not present have `acknowledgedAt: null`. Optional so the
   *  C-08 callers that don't pass it keep working. */
  acknowledgedAtByEmail?: Map<string, string>,
): MemberContributionStatus[] {
  return members.map((m) => {
    const mine = signalsForMember(m, signals);
    let last: Date | null = null;
    for (const s of mine) {
      if (!last || s.at.getTime() > last.getTime()) last = s.at;
    }
    const contributed = mine.length > 0;
    return {
      id: m.id,
      kind: m.kind,
      displayName: m.displayName,
      email: m.email,
      status: m.status,
      acceptedAt: iso(m.acceptedAt),
      contributed,
      lastContributionAt: iso(last),
      resendable: m.status === "PENDING" || m.status === "DECLINED",
      acknowledgedAt: acknowledgedAtByEmail?.get(m.email.trim().toLowerCase()) ?? null,
    };
  });
}

/** Roll the per-member statuses into the "N of M voices" summary the
 *  ceremony chip and the hub header both show. Invited counts every
 *  non-revoked member; contributed counts those with a landed contribution. */
export function summariseVoices(statuses: MemberContributionStatus[]): {
  invited: number;
  contributed: number;
} {
  const live = statuses.filter((s) => s.status !== "REVOKED");
  return {
    invited: live.length,
    contributed: live.filter((s) => s.contributed).length,
  };
}
