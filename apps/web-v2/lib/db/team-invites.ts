/**
 * Care-team invite registry: teacher / caregiver / therapist links per learner.
 *
 * Mirrors the legacy aivo-ai-learning `learnerTeachers / learnerCaregivers /
 * learnerTherapists` tables from `services/family-svc/src/routes/collaboration.ts`
 * but lives in the in-memory store like every other web-v2 dataset until the
 * real Postgres backend is wired. The shape, seat limits, and lifecycle states
 * intentionally match the legacy backend so we can swap to a Drizzle-backed
 * implementation later without touching call sites.
 *
 * Seat limits (single source of truth, see legacy collaboration.ts:140-152):
 *   teacher: 1   caregiver: 2   therapist: 1
 */
import type { ID, ISODate } from "@/lib/db/types";

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

type Tables = {
  teachers: TeamMemberRecord[];
  caregivers: TeamMemberRecord[];
  therapists: TeamMemberRecord[];
};

declare global {
  // Module-scoped singleton, sibling to globalThis.__aivoStore.
  var __aivoTeamInvites: Tables | undefined;
}

function tables(): Tables {
  if (!globalThis.__aivoTeamInvites) {
    globalThis.__aivoTeamInvites = { teachers: [], caregivers: [], therapists: [] };
  }
  return globalThis.__aivoTeamInvites;
}

function newInviteId(role: TeamRole): ID {
  const r = Math.random().toString(36).slice(2, 10);
  return `inv_${role[0]}_${Date.now().toString(36)}${r}`;
}

function nowIso(): ISODate {
  return new Date().toISOString();
}

function tableFor(role: TeamRole): TeamMemberRecord[] {
  const t = tables();
  return role === "teacher" ? t.teachers : role === "caregiver" ? t.caregivers : t.therapists;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getCareTeam(learnerId: ID): LearnerCareTeam {
  const t = tables();
  const teachers = t.teachers.filter((r) => r.learnerId === learnerId && r.status !== "REVOKED");
  const caregivers = t.caregivers.filter(
    (r) => r.learnerId === learnerId && r.status !== "REVOKED",
  );
  const therapists = t.therapists.filter(
    (r) => r.learnerId === learnerId && r.status !== "REVOKED",
  );
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

export function createInvite(input: CreateInviteInput): CreateInviteResult {
  const email = normalizeEmail(input.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "A valid email is required.", status: 400 };
  }
  const list = tableFor(input.role);
  const dupe = list.find(
    (r) =>
      r.learnerId === input.learnerId &&
      r.email === email &&
      r.status !== "REVOKED" &&
      r.status !== "DECLINED",
  );
  if (dupe) {
    return {
      ok: false,
      error: `That ${input.role} is already invited.`,
      status: 409,
    };
  }
  const active = list.filter(
    (r) => r.learnerId === input.learnerId && r.status !== "REVOKED" && r.status !== "DECLINED",
  );
  if (active.length >= SEAT_LIMITS[input.role]) {
    return {
      ok: false,
      error: `All ${input.role} seats are full (${SEAT_LIMITS[input.role]}).`,
      status: 400,
    };
  }
  const record: TeamMemberRecord = {
    id: newInviteId(input.role),
    tenantId: input.tenantId,
    learnerId: input.learnerId,
    email,
    memberUserId: null,
    invitedBy: input.invitedBy,
    invitedAt: nowIso(),
    acceptedAt: null,
    status: "PENDING",
    relationship: input.role === "caregiver" ? (input.relationship ?? null) : null,
    specialty: input.role === "therapist" ? (input.specialty ?? null) : null,
    credentials: input.role === "therapist" ? (input.credentials ?? null) : null,
  };
  list.push(record);
  return { ok: true, record };
}

export function revokeInvite(
  role: TeamRole,
  inviteId: ID,
  learnerId: ID,
): { ok: boolean; error?: string } {
  const list = tableFor(role);
  const idx = list.findIndex((r) => r.id === inviteId && r.learnerId === learnerId);
  if (idx === -1) return { ok: false, error: "Invite not found." };
  list[idx] = { ...list[idx], status: "REVOKED" };
  return { ok: true };
}

export type AcceptInviteResult = {
  accepted: { role: TeamRole; learnerId: ID; inviteId: ID }[];
  count: number;
};

/**
 * Accepts every PENDING invite addressed to `userEmail`, attaching the
 * caller's `userId` so future queries can resolve memberships by user.
 */
export function acceptAllInvitesForEmail(userEmail: string, userId: ID): AcceptInviteResult {
  const email = normalizeEmail(userEmail);
  const t = tables();
  const out: AcceptInviteResult = { accepted: [], count: 0 };
  const apply = (role: TeamRole, list: TeamMemberRecord[]) => {
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (r.email === email && r.status === "PENDING") {
        list[i] = { ...r, status: "ACCEPTED", acceptedAt: nowIso(), memberUserId: userId };
        out.accepted.push({ role, learnerId: r.learnerId, inviteId: r.id });
        out.count++;
      }
    }
  };
  apply("teacher", t.teachers);
  apply("caregiver", t.caregivers);
  apply("therapist", t.therapists);
  return out;
}

export function listPendingInvitesForEmail(userEmail: string): TeamMemberRecord[] {
  const email = normalizeEmail(userEmail);
  const t = tables();
  return [...t.teachers, ...t.caregivers, ...t.therapists].filter(
    (r) => r.email === email && r.status === "PENDING",
  );
}

export function listLearnersForMember(userId: ID, userEmail: string, role: TeamRole): ID[] {
  const email = normalizeEmail(userEmail);
  const list = tableFor(role);
  return Array.from(
    new Set(
      list
        .filter((r) => r.status === "ACCEPTED" && (r.memberUserId === userId || r.email === email))
        .map((r) => r.learnerId),
    ),
  );
}

/** Test/dev helper — seeds a couple of demo invites so the UI has content. */
export function seedDemoInvites(args: { tenantId: ID; learnerId: ID; invitedBy: ID }): void {
  const t = tables();
  if (t.teachers.length || t.caregivers.length || t.therapists.length) return;
  t.caregivers.push({
    id: newInviteId("caregiver"),
    tenantId: args.tenantId,
    learnerId: args.learnerId,
    email: "grandma@example.com",
    memberUserId: null,
    invitedBy: args.invitedBy,
    invitedAt: nowIso(),
    acceptedAt: null,
    status: "PENDING",
    relationship: "Grandparent",
    specialty: null,
    credentials: null,
  });
}
