"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { getLearner, parentCanAccessLearner, setTeamInviteDecision } from "@/lib/db/repos";
import { createInvite, getCareTeam, revokeInvite, type TeamRole } from "@/lib/db/team-invites";
import { nextStepFor } from "@/lib/learner/readiness";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";

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
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
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
  revalidatePath(`/parent/learners/${learnerId}/team`);
  return { ok: true, error: null };
}

/**
 * Sprint 3: complete the onboarding "invite your child's team" step. Sets
 * the parent's decision (`done` when ≥1 invite was sent, else `skipped`),
 * audits it, and advances to the readiness-computed next step (baseline /
 * IEP). Never a dead end — always redirects somewhere actionable.
 */
export async function completeTeamInviteStepAction(formData: FormData): Promise<void> {
  const session = await requirePageRole(["parent"]);
  const learnerId = String(formData.get("learnerId") ?? "");
  const intent = String(formData.get("intent") ?? "continue"); // "continue" | "skip"
  if (!learnerId) redirect("/parent/learners");
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    redirect("/parent/learners");
  }
  const team = await getCareTeam(learnerId, session.tenantId);
  const inviteCount = team.teachers.length + team.caregivers.length + team.therapists.length;
  const decision: "done" | "skipped" =
    intent === "skip" ? "skipped" : inviteCount > 0 ? "done" : "skipped";
  await setTeamInviteDecision(learnerId, session.tenantId, decision);
  audit(session, "team_invite.step_complete", newRequestId(), {
    learnerId,
    metadata: { decision, inviteCount, intent },
  });
  const learner = await getLearner(learnerId, session.tenantId);
  redirect(learner ? nextStepFor(learner).href : `/parent/learners/${learnerId}`);
}

export async function revokeTeamMemberAction(formData: FormData): Promise<void> {
  const session = await requirePageRole(["parent"]);
  const learnerId = String(formData.get("learnerId") ?? "");
  const inviteId = String(formData.get("inviteId") ?? "");
  const role = asRole(formData.get("role"));
  if (!learnerId || !inviteId || !role) return;
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) return;
  await revokeInvite(role, inviteId, learnerId, session.tenantId);
  revalidatePath(`/parent/learners/${learnerId}/team`);
}
