"use server";

import { revalidatePath } from "next/cache";
import { requirePageRole } from "@/lib/auth/server";
import { teacherCanAccessLearner } from "@/lib/db/repos";
import { createInvite, getCareTeam, revokeInvite, type TeamRole } from "@/lib/db/team-invites";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";

export type TeacherInviteFormState = { error: string | null; ok: boolean };

// A teacher builds out the rest of the child's team — the non-teaching adults
// (family caregivers and related-service therapists) who also know the learner.
// A teacher seat already belongs to this teacher, so "teacher" is intentionally
// NOT invitable from this surface; the parent-owned care team still governs the
// single teacher seat.
const TEACHER_INVITABLE_ROLES: TeamRole[] = ["caregiver", "therapist"];

function asInvitableRole(value: FormDataEntryValue | null): TeamRole | null {
  if (typeof value !== "string") return null;
  return (TEACHER_INVITABLE_ROLES as string[]).includes(value) ? (value as TeamRole) : null;
}

export async function inviteTeamMemberAction(
  _prev: TeacherInviteFormState,
  formData: FormData,
): Promise<TeacherInviteFormState> {
  const session = await requirePageRole(["teacher"]);
  const learnerId = String(formData.get("learnerId") ?? "");
  const role = asInvitableRole(formData.get("role"));
  const email = String(formData.get("email") ?? "");
  const relationship = String(formData.get("relationship") ?? "") || undefined;
  const specialty = String(formData.get("specialty") ?? "") || undefined;
  const credentials = String(formData.get("credentials") ?? "") || undefined;

  if (!learnerId || !role) {
    return { ok: false, error: "Pick a caregiver or therapist to invite." };
  }
  // RBAC: a teacher may only build the team for a learner they actually teach
  // (accepted classroom/roster link). Enforced server-side, never trusted from
  // the client.
  if (!(await teacherCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    return { ok: false, error: "You do not have access to that learner." };
  }

  const result = await createInvite({
    role,
    tenantId: session.tenantId,
    learnerId,
    email,
    invitedBy: session.userId,
    relationship,
    specialty,
    credentials,
  });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  audit(session, "team_invite.created_by_teacher", newRequestId(), {
    learnerId,
    metadata: { role, inviteId: result.record.id },
  });
  revalidatePath(`/teacher/learners/${learnerId}/team`);
  return { ok: true, error: null };
}

export async function revokeTeamMemberAction(formData: FormData): Promise<void> {
  const session = await requirePageRole(["teacher"]);
  const learnerId = String(formData.get("learnerId") ?? "");
  const inviteId = String(formData.get("inviteId") ?? "");
  const role = asInvitableRole(formData.get("role"));
  if (!learnerId || !inviteId || !role) return;
  if (!(await teacherCanAccessLearner(session.userId, learnerId, session.tenantId))) return;

  // A teacher may withdraw ONLY invites they personally sent — never a
  // parent-created or another collaborator's invite. Confirm authorship
  // against the live care team before revoking. A teacher may also only
  // withdraw an invite that is still PENDING: once a teammate has accepted (or
  // the invite is otherwise resolved), removing them is the family's call, not
  // the teacher's. Both checks are enforced server-side, not just in the UI, so
  // a crafted payload cannot revoke an accepted teammate.
  const team = await getCareTeam(learnerId, session.tenantId);
  const list = role === "caregiver" ? team.caregivers : team.therapists;
  const member = list.find((m) => m.id === inviteId);
  if (!member || member.invitedBy !== session.userId || member.status !== "PENDING") return;

  await revokeInvite(role, inviteId, learnerId, session.tenantId);
  audit(session, "team_invite.revoked_by_teacher", newRequestId(), {
    learnerId,
    metadata: { role, inviteId },
  });
  revalidatePath(`/teacher/learners/${learnerId}/team`);
}
