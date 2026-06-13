/**
 * In-memory ContributionAcknowledgementStore — wraps the
 * contributionAcknowledgements array. Selected when
 * AIVO_PERSISTENCE_CONTRIBUTION_ACKNOWLEDGEMENTS=memory (default).
 *
 * Append-only with an idempotent insert: `record` pushes one row UNLESS a row
 * already exists for the natural key (learnerId, profileRevision, role,
 * contributorEmail) — then it returns that row unchanged (so a re-approval of
 * the same revision never produces a second row). `markNotified` flips the
 * per-channel delivery flags. The store does not enforce the privacy invariant
 * on `foldedItems` — that is owned by the derivation in repos.ts.
 */
import { getStore } from "@/lib/db/store";
import type { ContributionAcknowledgement } from "@/lib/db/types";
import type { ContributionAcknowledgementStore } from "../types";

function newestFirst(a: ContributionAcknowledgement, b: ContributionAcknowledgement): number {
  return (
    b.acknowledgedAt.localeCompare(a.acknowledgedAt) || b.id.localeCompare(a.id)
  );
}

function sameKey(a: ContributionAcknowledgement, b: ContributionAcknowledgement): boolean {
  return (
    a.learnerId === b.learnerId &&
    a.profileRevision === b.profileRevision &&
    a.role === b.role &&
    a.contributorEmail === b.contributorEmail
  );
}

export const memoryContributionAcknowledgements: ContributionAcknowledgementStore = {
  async record(ack: ContributionAcknowledgement) {
    const existing = getStore().contributionAcknowledgements.find((row) => sameKey(row, ack));
    if (existing) return { ack: existing, created: false };
    getStore().contributionAcknowledgements.push(ack);
    return { ack, created: true };
  },

  async listForContributor({ tenantId, contributorUserId, contributorEmail, learnerId }) {
    const email = contributorEmail.trim().toLowerCase();
    return getStore()
      .contributionAcknowledgements.filter(
        (a) =>
          a.tenantId === tenantId &&
          (learnerId ? a.learnerId === learnerId : true) &&
          // Own items only: match by account id when present, else by email.
          ((contributorUserId && a.contributorUserId === contributorUserId) ||
            a.contributorEmail === email),
      )
      .sort(newestFirst);
  },

  async listForLearner(learnerId, tenantId) {
    return getStore()
      .contributionAcknowledgements.filter(
        (a) => a.learnerId === learnerId && a.tenantId === tenantId,
      )
      .sort(newestFirst);
  },

  async listForTenant(tenantId) {
    return getStore()
      .contributionAcknowledgements.filter((a) => a.tenantId === tenantId)
      .sort(newestFirst);
  },

  async markNotified(id, flags) {
    const row = getStore().contributionAcknowledgements.find((a) => a.id === id);
    if (!row) return null;
    if (flags.notifiedInApp !== undefined) row.notifiedInApp = flags.notifiedInApp;
    if (flags.notifiedEmail !== undefined) row.notifiedEmail = flags.notifiedEmail;
    return row;
  },
};
