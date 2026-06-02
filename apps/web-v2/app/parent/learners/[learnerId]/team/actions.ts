"use server";

import { revalidatePath } from "next/cache";
import { requirePageRole } from "@/lib/auth/server";
import { parentCanAccessLearner } from "@/lib/db/repos";
import { createInvite, revokeInvite, type TeamRole } from "@/lib/db/team-invites";

export type InviteFormState = { error: string | null; ok: boolean };

const ROLES: TeamRole[] = ["teacher", "caregiver", "therapist"];

function asRole(value: FormDataEntryValue | null): TeamRole | null {
  if (typeof value !== "string") return null;
  return (ROLES as string[]).includes(value) ? (value as TeamRole) : null;
}

export async function inviteTeamMemberAction(
  _prev: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const session = await requirePageRole(["parent"]);
  const learnerId = String(formData.get("learnerId") ?? "");
  const role = asRole(formData.get("role"));
  const email = String(formData.get("email") ?? "");
  const relationship = String(formData.get("relationship") ?? "") || undefined;
  const specialty = String(formData.get("specialty") ?? "") || undefined;
  const credentials = String(formData.get("credentials") ?? "") || undefined;

  if (!learnerId || !role) {
    return { ok: false, error: "Missing learner or role." };
  }
  if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    return { ok: false, error: "You do not have access to that learner." };
  }
  const result = createInvite({
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
  revalidatePath(`/parent/learners/${learnerId}/team`);
  return { ok: true, error: null };
}

export async function revokeTeamMemberAction(formData: FormData): Promise<void> {
  const session = await requirePageRole(["parent"]);
  const learnerId = String(formData.get("learnerId") ?? "");
  const inviteId = String(formData.get("inviteId") ?? "");
  const role = asRole(formData.get("role"));
  if (!learnerId || !inviteId || !role) return;
  if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) return;
  revokeInvite(role, inviteId, learnerId);
  revalidatePath(`/parent/learners/${learnerId}/team`);
}
