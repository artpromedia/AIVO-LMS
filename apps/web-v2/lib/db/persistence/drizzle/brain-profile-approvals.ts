/**
 * Drizzle-backed BrainProfileApprovalStore.
 *
 * Selected when AIVO_PERSISTENCE_BRAIN_PROFILE_APPROVALS=postgres. Backed by
 * the `brain_profile_approvals` table
 * (packages/db/src/schema/brain-profile-approvals.ts, migration 0108).
 * Mirrors the memory store: `record` inserts one row; `listForLearner`
 * returns the tenant-scoped history newest-first.
 */
import { and, desc, eq } from "drizzle-orm";
import { brainProfileApprovals } from "@aivo/db";
import type { BrainProfileApproval } from "@/lib/db/types";
import type { BrainProfileApprovalStore } from "../types";
import { getDb } from "./client";

type Row = typeof brainProfileApprovals.$inferSelect;

function rowToApproval(row: Row): BrainProfileApproval {
  return {
    id: row.id,
    tenantId: row.tenantId,
    learnerId: row.learnerId,
    brainProfileId: row.brainProfileId,
    profileRevision: row.profileRevision,
    actorUserId: row.actorUserId,
    action: row.action as BrainProfileApproval["action"],
    consentVersion: row.consentVersion,
    raiVersion: row.raiVersion,
    modifications: (row.modifications ?? []) as BrainProfileApproval["modifications"],
    ipHash: row.ipHash ?? null,
    createdAt: row.createdAt,
  };
}

export const drizzleBrainProfileApprovals: BrainProfileApprovalStore = {
  async record(approval: BrainProfileApproval) {
    const db = getDb();
    await db.insert(brainProfileApprovals).values({
      id: approval.id,
      tenantId: approval.tenantId,
      learnerId: approval.learnerId,
      brainProfileId: approval.brainProfileId,
      profileRevision: approval.profileRevision,
      actorUserId: approval.actorUserId,
      action: approval.action,
      consentVersion: approval.consentVersion,
      raiVersion: approval.raiVersion,
      modifications: approval.modifications,
      ipHash: approval.ipHash,
      createdAt: approval.createdAt,
    });
    return approval;
  },

  async listForLearner(learnerId, tenantId) {
    const db = getDb();
    const rows = await db
      .select()
      .from(brainProfileApprovals)
      .where(
        and(
          eq(brainProfileApprovals.learnerId, learnerId),
          eq(brainProfileApprovals.tenantId, tenantId),
        ),
      )
      .orderBy(desc(brainProfileApprovals.createdAt));
    return rows.map(rowToApproval);
  },
};
