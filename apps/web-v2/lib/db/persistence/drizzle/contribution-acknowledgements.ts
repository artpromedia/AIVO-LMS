/**
 * Drizzle-backed ContributionAcknowledgementStore.
 *
 * Selected when AIVO_PERSISTENCE_CONTRIBUTION_ACKNOWLEDGEMENTS=postgres. Backed
 * by the `contribution_acknowledgements` table
 * (packages/db/src/schema/contribution-acknowledgements.ts, migration 0116).
 * Mirrors the memory store: `record` performs an idempotent insert
 * (ON CONFLICT DO NOTHING on the natural-key unique index); `listForContributor`
 * returns a contributor's OWN rows; `listForLearner` / `listForTenant` are the
 * retention/admin reads; `markNotified` flips the per-channel flags.
 */
import { and, desc, eq, or } from "drizzle-orm";
import { contributionAcknowledgements } from "@aivo/db";
import type { ContributionAcknowledgement, ContributionFoldedItem } from "@/lib/db/types";
import type { ContributionAcknowledgementStore } from "../types";
import { getDb } from "./client";

type Row = typeof contributionAcknowledgements.$inferSelect;

function rowToAck(row: Row): ContributionAcknowledgement {
  return {
    id: row.id,
    tenantId: row.tenantId,
    learnerId: row.learnerId,
    brainProfileId: row.brainProfileId,
    profileRevision: row.profileRevision,
    role: row.role as ContributionAcknowledgement["role"],
    contributorUserId: row.contributorUserId ?? null,
    contributorEmail: row.contributorEmail,
    learnerFirstName: row.learnerFirstName,
    foldedItems: (row.foldedItems ?? []) as ContributionFoldedItem[],
    acknowledgedAt: row.acknowledgedAt,
    notifiedInApp: row.notifiedInApp,
    notifiedEmail: row.notifiedEmail,
    createdAt: row.createdAt,
  };
}

export const drizzleContributionAcknowledgements: ContributionAcknowledgementStore = {
  async record(ack: ContributionAcknowledgement) {
    const db = getDb();
    // Idempotent insert: a duplicate natural key (learnerId, profileRevision,
    // role, contributorEmail) is skipped via the unique index, so a re-approval
    // of the same revision never produces a second row.
    const inserted = await db
      .insert(contributionAcknowledgements)
      .values({
        id: ack.id,
        tenantId: ack.tenantId,
        learnerId: ack.learnerId,
        brainProfileId: ack.brainProfileId,
        profileRevision: ack.profileRevision,
        role: ack.role,
        contributorUserId: ack.contributorUserId,
        contributorEmail: ack.contributorEmail,
        learnerFirstName: ack.learnerFirstName,
        foldedItems: ack.foldedItems,
        acknowledgedAt: ack.acknowledgedAt,
        notifiedInApp: ack.notifiedInApp,
        notifiedEmail: ack.notifiedEmail,
        createdAt: ack.createdAt,
      })
      .onConflictDoNothing({
        target: [
          contributionAcknowledgements.learnerId,
          contributionAcknowledgements.profileRevision,
          contributionAcknowledgements.role,
          contributionAcknowledgements.contributorEmail,
        ],
      })
      .returning();
    if (inserted.length > 0) return { ack: rowToAck(inserted[0]), created: true };
    // Conflict: fetch + return the existing row.
    const [existing] = await db
      .select()
      .from(contributionAcknowledgements)
      .where(
        and(
          eq(contributionAcknowledgements.learnerId, ack.learnerId),
          eq(contributionAcknowledgements.profileRevision, ack.profileRevision),
          eq(contributionAcknowledgements.role, ack.role),
          eq(contributionAcknowledgements.contributorEmail, ack.contributorEmail),
        ),
      )
      .limit(1);
    return { ack: existing ? rowToAck(existing) : ack, created: false };
  },

  async listForContributor({ tenantId, contributorUserId, contributorEmail, learnerId }) {
    const db = getDb();
    const email = contributorEmail.trim().toLowerCase();
    const ownership = contributorUserId
      ? or(
          eq(contributionAcknowledgements.contributorUserId, contributorUserId),
          eq(contributionAcknowledgements.contributorEmail, email),
        )
      : eq(contributionAcknowledgements.contributorEmail, email);
    const where = [eq(contributionAcknowledgements.tenantId, tenantId), ownership];
    if (learnerId) where.push(eq(contributionAcknowledgements.learnerId, learnerId));
    const rows = await db
      .select()
      .from(contributionAcknowledgements)
      .where(and(...where))
      .orderBy(desc(contributionAcknowledgements.acknowledgedAt));
    return rows.map(rowToAck);
  },

  async listForLearner(learnerId, tenantId) {
    const db = getDb();
    const rows = await db
      .select()
      .from(contributionAcknowledgements)
      .where(
        and(
          eq(contributionAcknowledgements.learnerId, learnerId),
          eq(contributionAcknowledgements.tenantId, tenantId),
        ),
      )
      .orderBy(desc(contributionAcknowledgements.acknowledgedAt));
    return rows.map(rowToAck);
  },

  async listForTenant(tenantId) {
    const db = getDb();
    const rows = await db
      .select()
      .from(contributionAcknowledgements)
      .where(eq(contributionAcknowledgements.tenantId, tenantId))
      .orderBy(desc(contributionAcknowledgements.acknowledgedAt));
    return rows.map(rowToAck);
  },

  async markNotified(id, flags) {
    const db = getDb();
    const patch: Partial<Row> = {};
    if (flags.notifiedInApp !== undefined) patch.notifiedInApp = flags.notifiedInApp;
    if (flags.notifiedEmail !== undefined) patch.notifiedEmail = flags.notifiedEmail;
    if (Object.keys(patch).length === 0) {
      const [row] = await db
        .select()
        .from(contributionAcknowledgements)
        .where(eq(contributionAcknowledgements.id, id))
        .limit(1);
      return row ? rowToAck(row) : null;
    }
    const updated = await db
      .update(contributionAcknowledgements)
      .set(patch)
      .where(eq(contributionAcknowledgements.id, id))
      .returning();
    return updated.length > 0 ? rowToAck(updated[0]) : null;
  },
};
