/**
 * Messageable-contact resolution for the parent inbox.
 *
 * A parent can only start a thread with a REAL, accepted care-team member of
 * one of their own learners (teacher / therapist / caregiver — and coach once
 * that role exists). This is the access-control source of truth for compose:
 * the BFF resolves the contact list here and re-validates the chosen recipient
 * against it before creating a thread, so a parent can never message an
 * arbitrary user id.
 *
 * COPPA: contacts are adults with accounts (`memberUserId` set + ACCEPTED).
 * The learner is never a contact; threads are adult↔adult and carry only the
 * learner's display name as context (which the parent already sees).
 */
import { listLearnersForParent, getUserById } from "@/lib/db/repos";
import { getCareTeam, type TeamMemberRecord } from "@/lib/db/team-invites";

export type MessageContactRole = "teacher" | "therapist" | "caregiver" | "coach";

export type MessageContact = {
  userId: string;
  displayName: string;
  role: MessageContactRole;
  /** The learner this care relationship is about. */
  learnerId: string;
  learnerName: string;
};

/** Pure: collapse duplicate (userId, learnerId) pairs; deterministic order. */
export function dedupeContacts(contacts: MessageContact[]): MessageContact[] {
  const seen = new Map<string, MessageContact>();
  for (const c of contacts) {
    const key = `${c.userId}:${c.learnerId}`;
    if (!seen.has(key)) seen.set(key, c);
  }
  return [...seen.values()].sort(
    (a, b) =>
      a.learnerName.localeCompare(b.learnerName) ||
      a.displayName.localeCompare(b.displayName) ||
      a.role.localeCompare(b.role),
  );
}

/** Every accepted care-team member across the parent's learners, deduped. */
export async function listMessageableContacts(
  parentUserId: string,
  tenantId: string,
): Promise<MessageContact[]> {
  const learners = await listLearnersForParent(parentUserId, tenantId);
  const out: MessageContact[] = [];
  for (const learner of learners) {
    const team = await getCareTeam(learner.id, tenantId);
    const groups: Array<[MessageContactRole, TeamMemberRecord[]]> = [
      ["teacher", team.teachers],
      ["therapist", team.therapists],
      ["caregiver", team.caregivers],
    ];
    for (const [role, members] of groups) {
      for (const m of members) {
        if (!m.memberUserId || m.status !== "ACCEPTED") continue;
        const user = await getUserById(m.memberUserId);
        if (!user) continue;
        out.push({
          userId: m.memberUserId,
          displayName: user.displayName,
          role,
          learnerId: learner.id,
          learnerName: learner.displayName,
        });
      }
    }
  }
  return dedupeContacts(out);
}

/**
 * Access-control gate for compose: returns the matching contact when
 * `recipientUserId` is an accepted care-team member for `learnerId` under this
 * parent, or `null` when the pairing is not permitted.
 */
export async function resolveMessageRecipient(
  parentUserId: string,
  tenantId: string,
  recipientUserId: string,
  learnerId: string,
): Promise<MessageContact | null> {
  const contacts = await listMessageableContacts(parentUserId, tenantId);
  return (
    contacts.find((c) => c.userId === recipientUserId && c.learnerId === learnerId) ?? null
  );
}
