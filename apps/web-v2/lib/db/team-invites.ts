/**
 * Care-team invite registry: teacher / caregiver / therapist links per learner.
 *
 * Sprint 4 fold-in: this module is now PERSISTENCE-BACKED via the
 * `collaboration` domain (web_collaborator_members + the in-memory adapter),
 * replacing the former process-local global. Invites therefore survive a
 * server restart and are tenant-isolated. The public types
 * (TeamRole / TeamMemberRecord / LearnerCareTeam / SEAT_LIMITS) are unchanged
 * so call sites only gain `await` + a tenantId argument.
 *
 * Seat limits (single source of truth, matching the family-svc backend):
 *   teacher: 1   caregiver: 2   therapist: 1
 */
import { getPersistence } from "@/lib/db/persistence";
import { newId, nowIso } from "@/lib/db/store";
import type {
  CollaboratorMember,
  CollaboratorMemberStatus,
  ID,
  ISODate,
} from "@/lib/db/types";

export type TeamRole = "teacher" | "caregiver" | "therapist";

export type InviteStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED";

export type TeamMemberRecord = {
  id: ID;
  tenantId: ID;
  learnerId: ID;
  /** invitee email, lowercased */
  email: string;
  /** populated once the invitee accepts and we resolve a user account */
  memberUserId: ID | null;
  invitedBy: ID;
  invitedAt: ISODate;
  acceptedAt: ISODate | null;
  status: InviteStatus;
  /** caregiver-only — free-form ("Co-parent", "Grandparent", …) */
  relationship: string | null;
  /** therapist-only */
  specialty: string | null;
  /** therapist-only */
  credentials: string | null;
};

export type SeatInfo = { used: number; max: number };

export type LearnerCareTeam = {
  teachers: TeamMemberRecord[];
  caregivers: TeamMemberRecord[];
  therapists: TeamMemberRecord[];
  seats: { teacher: SeatInfo; caregiver: SeatInfo; therapist: SeatInfo };
};

export const SEAT_LIMITS: Record<TeamRole, number> = {
  teacher: 1,
  caregiver: 2,
  therapist: 1,
};

const STATUS_UP: Record<CollaboratorMemberStatus, InviteStatus> = {
  pending: "PENDING",
  accepted: "ACCEPTED",
  declined: "DECLINED",
  revoked: "REVOKED",
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Map a stored CollaboratorMember to the UI-facing TeamMemberRecord shape. */
function toRecord(m: CollaboratorMember): TeamMemberRecord {
  return {
    id: m.id,
    tenantId: m.tenantId,
    learnerId: m.learnerId,
    email: m.email,
    memberUserId: m.memberUserId,
    invitedBy: m.invitedBy ?? "",
    invitedAt: m.createdAt,
    acceptedAt: m.acceptedAt,
    status: STATUS_UP[m.status],
    relationship: m.relationship ?? null,
    specialty: m.specialty ?? null,
    credentials: m.credentials ?? null,
  };
}

function isActive(m: CollaboratorMember): boolean {
  return m.status !== "revoked" && m.status !== "declined";
}

export async function getCareTeam(learnerId: ID, tenantId: ID): Promise<LearnerCareTeam> {
  const members = await getPersistence().collaboration.listMembersForLearner(learnerId, tenantId);
  const visible = members.filter((m) => m.status !== "revoked");
  const byRole = (role: TeamRole) =>
    visible.filter((m) => m.role === role).map(toRecord);
  const teachers = byRole("teacher");
  const caregivers = byRole("caregiver");
  const therapists = byRole("therapist");
  return {
    teachers,
    caregivers,
    therapists,
    seats: {
      teacher: { used: teachers.length, max: SEAT_LIMITS.teacher },
      caregiver: { used: caregivers.length, max: SEAT_LIMITS.caregiver },
      therapist: { used: therapists.length, max: SEAT_LIMITS.therapist },
    },
  };
}

export type CreateInviteInput = {
  role: TeamRole;
  tenantId: ID;
  learnerId: ID;
  email: string;
  invitedBy: ID;
  relationship?: string;
  specialty?: string;
  credentials?: string;
};

export type CreateInviteResult =
  | { ok: true; record: TeamMemberRecord }
  | { ok: false; error: string; status: 400 | 409 };

export async function createInvite(input: CreateInviteInput): Promise<CreateInviteResult> {
  const email = normalizeEmail(input.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "A valid email is required.", status: 400 };
  }
  const collab = getPersistence().collaboration;
  const members = await collab.listMembersForLearner(input.learnerId, input.tenantId);
  const sameRole = members.filter((m) => m.role === input.role && isActive(m));
  if (sameRole.some((m) => m.email === email)) {
    return { ok: false, error: `That ${input.role} is already invited.`, status: 409 };
  }
  if (sameRole.length >= SEAT_LIMITS[input.role]) {
    return {
      ok: false,
      error: `All ${input.role} seats are full (${SEAT_LIMITS[input.role]}).`,
      status: 400,
    };
  }
  const member: CollaboratorMember = {
    id: newId("inv"),
    learnerId: input.learnerId,
    tenantId: input.tenantId,
    role: input.role,
    email,
    memberUserId: null,
    status: "pending",
    acceptedAt: null,
    createdAt: nowIso(),
    invitedBy: input.invitedBy,
    relationship: input.role === "caregiver" ? (input.relationship ?? null) : null,
    specialty: input.role === "therapist" ? (input.specialty ?? null) : null,
    credentials: input.role === "therapist" ? (input.credentials ?? null) : null,
  };
  const saved = await collab.upsertMember(member);
  return { ok: true, record: toRecord(saved) };
}

export async function revokeInvite(
  role: TeamRole,
  inviteId: ID,
  learnerId: ID,
  tenantId: ID,
): Promise<{ ok: boolean; error?: string }> {
  const collab = getPersistence().collaboration;
  const members = await collab.listMembersForLearner(learnerId, tenantId);
  const found = members.find((m) => m.id === inviteId && m.role === role);
  if (!found) return { ok: false, error: "Invite not found." };
  await collab.upsertMember({ ...found, status: "revoked" });
  return { ok: true };
}

export type AcceptInviteResult = {
  accepted: { role: TeamRole; learnerId: ID; inviteId: ID }[];
  count: number;
};

/**
 * Accepts every PENDING invite addressed to `userEmail` in the tenant,
 * attaching the caller's `userId` so future queries resolve by user.
 */
export async function acceptAllInvitesForEmail(
  userEmail: string,
  userId: ID,
  tenantId: ID,
): Promise<AcceptInviteResult> {
  const email = normalizeEmail(userEmail);
  const collab = getPersistence().collaboration;
  const members = await collab.listMembersForTenant(tenantId);
  const out: AcceptInviteResult = { accepted: [], count: 0 };
  for (const m of members) {
    if (m.email === email && m.status === "pending" && m.role !== "parent") {
      await collab.upsertMember({
        ...m,
        status: "accepted",
        acceptedAt: nowIso(),
        memberUserId: userId,
      });
      out.accepted.push({ role: m.role as TeamRole, learnerId: m.learnerId, inviteId: m.id });
      out.count++;
    }
  }
  return out;
}

export async function listPendingInvitesForEmail(
  userEmail: string,
  tenantId: ID,
): Promise<TeamMemberRecord[]> {
  const email = normalizeEmail(userEmail);
  const members = await getPersistence().collaboration.listMembersForTenant(tenantId);
  return members.filter((m) => m.email === email && m.status === "pending").map(toRecord);
}

export async function listLearnersForMember(
  userId: ID,
  userEmail: string,
  role: TeamRole,
  tenantId: ID,
): Promise<ID[]> {
  const email = normalizeEmail(userEmail);
  const members = await getPersistence().collaboration.listMembersForTenant(tenantId);
  return Array.from(
    new Set(
      members
        .filter(
          (m) =>
            m.role === role &&
            m.status === "accepted" &&
            (m.memberUserId === userId || m.email === email),
        )
        .map((m) => m.learnerId),
    ),
  );
}
