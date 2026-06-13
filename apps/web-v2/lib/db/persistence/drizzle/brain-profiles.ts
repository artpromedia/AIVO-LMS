/**
 * Drizzle-backed BrainProfileStore.
 *
 * Selected when AIVO_PERSISTENCE_BRAIN_PROFILES=postgres. Backed by the
 * `learner_brain_profiles` table (packages/db/src/schema/learner-brain-profiles.ts,
 * migration 0048). Mirrors the memory store: getForLearner returns the
 * single tenant-scoped profile for a learner; upsert is keyed on id.
 */
import { and, eq } from "drizzle-orm";
import { learnerBrainProfiles } from "@aivo/db";
import type { LearnerBrainProfile } from "@/lib/db/types";
import type { BrainProfileStore } from "../types";
import { getDb } from "./client";

type Row = typeof learnerBrainProfiles.$inferSelect;

function rowToProfile(row: Row): LearnerBrainProfile {
  return {
    id: row.id,
    learnerId: row.learnerId,
    tenantId: row.tenantId,
    state: (row.state ?? {}) as LearnerBrainProfile["state"],
    approvedByParent: row.approvedByParent ?? false,
    approvalStatus: (row.approvalStatus ??
      "pending_parent_review") as LearnerBrainProfile["approvalStatus"],
    cloneStage: (row.cloneStage ?? "pre_clone") as LearnerBrainProfile["cloneStage"],
    // Backfill default for rows written before the column existed (C-06).
    revision: row.revision ?? 1,
    clonedAt: row.clonedAt ?? null,
    generatedAt: row.generatedAt,
    updatedAt: row.updatedAt,
  };
}

export const drizzleBrainProfiles: BrainProfileStore = {
  async getForLearner(learnerId, tenantId) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(learnerBrainProfiles)
      .where(
        and(
          eq(learnerBrainProfiles.learnerId, learnerId),
          eq(learnerBrainProfiles.tenantId, tenantId),
        ),
      )
      .limit(1);
    return row ? rowToProfile(row) : null;
  },

  async upsert(profile: LearnerBrainProfile) {
    const db = getDb();
    const values = {
      id: profile.id,
      learnerId: profile.learnerId,
      tenantId: profile.tenantId,
      approvalStatus: profile.approvalStatus,
      cloneStage: profile.cloneStage,
      approvedByParent: profile.approvedByParent,
      revision: profile.revision,
      clonedAt: profile.clonedAt,
      generatedAt: profile.generatedAt,
      updatedAt: profile.updatedAt,
      state: profile.state,
    };
    const { id: _id, ...set } = values;
    await db
      .insert(learnerBrainProfiles)
      .values(values)
      .onConflictDoUpdate({ target: learnerBrainProfiles.id, set });
    return profile;
  },
};
