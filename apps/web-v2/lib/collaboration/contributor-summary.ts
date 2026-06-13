/**
 * Sprint C-16 — server-side composition of a contributor's "Your contributions"
 * summaries (the data the role-home card renders).
 *
 * For the signed-in contributor (teacher / caregiver / therapist), resolve the
 * learners whose care team they're on and, for each, their OWN per-learner
 * summary state (never_contributed | contributed_pending | acknowledged) with
 * their OWN folded items. Own-items-only by construction: every read is scoped
 * by (contributorUserId | email), and the per-learner summary comes from the
 * contributor-scoped derivation (`getContributorSummary`).
 *
 * Server-only: never import from a client component.
 */
import { getCareTeam, listLearnersForMember, type TeamRole } from "@/lib/db/team-invites";
import { getLearner } from "@/lib/db/repos";
import {
  getContributorSummary,
  type ContributorLearnerSummary,
} from "@/lib/collaboration/contribution-status";

/** The input-flow CTA target for the never-contributed state, per role. */
export function contributorInputFlowPath(role: TeamRole, learnerId: string): string {
  switch (role) {
    case "teacher":
      return `/teacher/learners/${learnerId}/assessment/intro`;
    case "therapist":
      return `/therapist/learners/${learnerId}/assessment`;
    case "caregiver":
      return `/caregiver/observations?learnerId=${learnerId}`;
  }
}

/** The contributor's first name for the learner record, falling back gracefully. */
function learnerFirstName(displayName: string | null | undefined, firstName?: string): string {
  const fn = (firstName ?? "").trim();
  if (fn) return fn;
  const dn = (displayName ?? "").trim();
  return dn ? (dn.split(/\s+/)[0] ?? "your learner") : "your learner";
}

/**
 * Build the contributor's per-learner summaries for their role. Returns one
 * entry per learner whose care team they're accepted on, ordered by the
 * learner's display name. A learner the contributor can't resolve (removed /
 * cross-tenant) is dropped.
 */
export async function getContributorLearnerSummaries(opts: {
  role: TeamRole;
  tenantId: string;
  contributorUserId: string;
  contributorEmail: string;
}): Promise<ContributorLearnerSummary[]> {
  const { role, tenantId, contributorUserId, contributorEmail } = opts;
  const learnerIds = await listLearnersForMember(
    contributorUserId,
    contributorEmail,
    role,
    tenantId,
  );
  const email = contributorEmail.trim().toLowerCase();

  const summaries = await Promise.all(
    learnerIds.map(async (learnerId) => {
      const learner = await getLearner(learnerId, tenantId);
      if (!learner) return null;
      // Find THIS contributor's care-team row for the learner (own row only).
      const team = await getCareTeam(learnerId, tenantId);
      const roster =
        role === "teacher"
          ? team.teachers
          : role === "caregiver"
            ? team.caregivers
            : team.therapists;
      const member =
        roster.find(
          (m) =>
            (m.memberUserId && m.memberUserId === contributorUserId) ||
            m.email.trim().toLowerCase() === email,
        ) ?? null;
      if (!member) return null;
      const summary = await getContributorSummary({
        role,
        member,
        learnerId,
        learnerFirstName: learnerFirstName(learner.displayName, learner.firstName),
        tenantId,
        contributorUserId,
        contributorEmail: email,
      });
      return { summary, sortName: learner.displayName ?? "" };
    }),
  );

  return summaries
    .filter((s): s is { summary: ContributorLearnerSummary; sortName: string } => s !== null)
    .sort((a, b) => a.sortName.localeCompare(b.sortName))
    .map((s) => s.summary);
}
