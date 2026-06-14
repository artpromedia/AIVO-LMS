import { fail } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import type { SessionProfile } from "@/lib/auth/types";
import { listLearnersForMember } from "@/lib/db/team-invites";

export const CAREGIVER_CAPABILITIES = [
  "caregiver.view_summary",
  "caregiver.view_schedule",
  "caregiver.add_observation",
  "caregiver.view_notifications",
  "caregiver.view_progress_limited",
] as const;

export type CaregiverCapability = (typeof CAREGIVER_CAPABILITIES)[number];

const DEFAULT_CAPABILITIES = new Set<CaregiverCapability>(CAREGIVER_CAPABILITIES);

export async function caregiverHasLearnerGrant(
  session: Pick<SessionProfile, "userId" | "email" | "tenantId" | "role">,
  learnerId: string,
): Promise<boolean> {
  if (session.role !== "caregiver") return false;
  const learnerIds = await listLearnersForMember(session.userId, session.email, "caregiver", session.tenantId);
  return learnerIds.includes(learnerId);
}

export async function requireCaregiverCapability(
  session: SessionProfile,
  learnerId: string,
  capability: CaregiverCapability,
  requestId: string,
) {
  if (session.role !== "caregiver") {
    return fail({ ...ERRORS.FORBIDDEN_ROLE, message: "Caregiver role required" }, requestId);
  }
  if (!DEFAULT_CAPABILITIES.has(capability)) {
    return fail({ ...ERRORS.FORBIDDEN_ROLE, message: `Caregiver capability ${capability} is not granted` }, requestId);
  }
  if (!(await caregiverHasLearnerGrant(session, learnerId))) {
    return fail({ ...ERRORS.FORBIDDEN_LEARNER, message: "Caregiver not granted access to learner" }, requestId);
  }
  return null;
}

export function caregiverCapabilityMatrix() {
  return {
    grantedByDefault: [...CAREGIVER_CAPABILITIES],
    parentOnlyDenied: [
      "billing.manage",
      "consent.manage",
      "data.export",
      "data.delete",
      "brain.approve",
      "account.manage",
    ],
  };
}
