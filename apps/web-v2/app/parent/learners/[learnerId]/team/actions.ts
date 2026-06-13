"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { getLearner, parentCanAccessLearner, setTeamInviteDecision } from "@/lib/db/repos";
import { createInvite, getCareTeam, revokeInvite, type TeamRole } from "@/lib/db/team-invites";
import { nextStepFor } from "@/lib/learner/readiness";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";
import { clientEnv } from "@/lib/env";
import {
  getCommsBearer,
  isCommsSvcEnabled,
  remindTeamMemberSvc,
} from "@/lib/bff/comms-svc";
import { checkRemindRateLimit } from "@/lib/collaboration/remind-rate-limit";

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

export type RemindState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "rate_limited"; retryAfterSeconds: number }
  | { status: "error"; message: string };

/**
 * Sprint C-08 — one-tap "Remind" on the team hub. Re-sends the invite email
 * via comms-svc (same `collaboration_invite` template). A kind per-member
 * rate limit (1/hour) prevents a frustrated parent from blasting a teammate;
 * an exceeded limit returns `rate_limited` with a Retry-After the UI shows
 * warmly. Accepting/contributed members are not remindable (the button is
 * hidden), but we re-check here as defense-in-depth.
 */
export async function remindTeamMemberAction(
  _prev: RemindState,
  formData: FormData,
): Promise<RemindState> {
  const session = await requirePageRole(["parent"]);
  const learnerId = String(formData.get("learnerId") ?? "");
  const inviteId = String(formData.get("inviteId") ?? "");
  const role = asRole(formData.get("role"));
  const email = String(formData.get("email") ?? "");
  if (!learnerId || !inviteId || !role || !email) {
    return { status: "error", message: "Missing invite details." };
  }
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    return { status: "error", message: "You do not have access to that learner." };
  }

  // Confirm the invite still exists and is in a remindable state.
  const team = await getCareTeam(learnerId, session.tenantId);
  const list =
    role === "teacher" ? team.teachers : role === "caregiver" ? team.caregivers : team.therapists;
  const member = list.find((m) => m.id === inviteId);
  if (!member) return { status: "error", message: "That invite is no longer on the team." };
  if (member.status === "ACCEPTED") {
    // Already on the team — nothing to remind about.
    return { status: "error", message: "They've already joined the team." };
  }

  const rl = checkRemindRateLimit(session.tenantId, inviteId);
  if (!rl.ok) {
    return { status: "rate_limited", retryAfterSeconds: rl.retryAfterSeconds };
  }

  const learner = await getLearner(learnerId, session.tenantId);
  const acceptUrl = `${clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/accept-invite?email=${encodeURIComponent(
    member.email,
  )}`;

  // Best-effort delivery: comms-svc owns email. When the service stack is off
  // (dev/test without comms), the reminder is recorded as sent — the local
  // store has no email transport and the parent shouldn't see a false error.
  if (isCommsSvcEnabled()) {
    try {
      const bearer = await getCommsBearer();
      if (bearer) {
        const res = await remindTeamMemberSvc(bearer, member.email, {
          role,
          inviterName: session.displayName,
          learnerName: learner?.displayName,
          acceptUrl,
        });
        if (!res.ok) {
          // 429 from comms-svc: surface kindly with its Retry-After hint.
          if (res.status === 429) return { status: "rate_limited", retryAfterSeconds: 3600 };
          return { status: "error", message: "We couldn't send the reminder just now." };
        }
      }
    } catch {
      return { status: "error", message: "We couldn't send the reminder just now." };
    }
  }

  audit(session, "team_invite.remind", newRequestId(), {
    learnerId,
    metadata: { role, inviteId },
  });
  revalidatePath(`/parent/learners/${learnerId}/team`);
  return { status: "sent" };
}
