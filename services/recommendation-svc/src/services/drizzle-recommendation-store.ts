/**
 * Drizzle-backed persistence helpers for the recommendations-v2 table.
 *
 * The in-memory STORE in routes/recommendations.ts is the default for
 * development and tests; production wiring constructs this helper and
 * lets the route use it as the source of truth.
 */

import { desc, eq } from "drizzle-orm";
import type { Database } from "@aivo/db";
import {
  profileRecommendationSnapshots,
  profileRecommendationsV2,
} from "@aivo/db";
import type {
  BrainSnapshot,
  ProfileRecommendation,
  RecommendationEvidence,
} from "./types.js";

function rowToRecommendation(
  row: typeof profileRecommendationsV2.$inferSelect,
): ProfileRecommendation {
  return {
    id: row.id,
    learnerId: row.learnerId,
    type: row.type as ProfileRecommendation["type"],
    title: row.title,
    parentSummary: row.parentSummary,
    currentValue: row.currentValue,
    proposedValue: row.proposedValue,
    amendedValue: row.amendedValue ?? undefined,
    confidence: row.confidence,
    evidence: (row.evidenceJson as RecommendationEvidence[]) ?? [],
    safety: {
      requiresParentApproval: true,
      affectsIEP: row.affectsIep,
      affectsInstructionalAccess: row.affectsInstructionalAccess,
      reversible: row.reversible,
    },
    status: row.status as ProfileRecommendation["status"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    appliedAt: row.appliedAt ? row.appliedAt.toISOString() : undefined,
    declineReason: row.declineReason ?? undefined,
  };
}

export class DrizzleRecommendationStore {
  constructor(private readonly db: Database) {}

  async create(rec: ProfileRecommendation): Promise<ProfileRecommendation> {
    const [row] = await this.db
      .insert(profileRecommendationsV2)
      .values({
        id: rec.id,
        learnerId: rec.learnerId,
        type: rec.type,
        title: rec.title,
        parentSummary: rec.parentSummary,
        currentValue: rec.currentValue,
        proposedValue: rec.proposedValue,
        amendedValue: rec.amendedValue,
        confidence: rec.confidence,
        evidenceJson: rec.evidence,
        requiresParentApproval: rec.safety.requiresParentApproval,
        affectsIep: rec.safety.affectsIEP,
        affectsInstructionalAccess: rec.safety.affectsInstructionalAccess,
        reversible: rec.safety.reversible,
        status: rec.status,
        declineReason: rec.declineReason,
      })
      .returning();
    return rowToRecommendation(row);
  }

  async get(id: string): Promise<ProfileRecommendation | undefined> {
    const [row] = await this.db
      .select()
      .from(profileRecommendationsV2)
      .where(eq(profileRecommendationsV2.id, id));
    return row ? rowToRecommendation(row) : undefined;
  }

  async update(
    id: string,
    patch: Partial<ProfileRecommendation>,
  ): Promise<ProfileRecommendation | undefined> {
    const [row] = await this.db
      .update(profileRecommendationsV2)
      .set({
        status: patch.status,
        amendedValue: patch.amendedValue,
        appliedAt: patch.appliedAt ? new Date(patch.appliedAt) : undefined,
        declineReason: patch.declineReason,
        updatedAt: new Date(),
      })
      .where(eq(profileRecommendationsV2.id, id))
      .returning();
    return row ? rowToRecommendation(row) : undefined;
  }

  async listByLearner(learnerId: string): Promise<ProfileRecommendation[]> {
    const rows = await this.db
      .select()
      .from(profileRecommendationsV2)
      .where(eq(profileRecommendationsV2.learnerId, learnerId))
      .orderBy(desc(profileRecommendationsV2.createdAt));
    return rows.map(rowToRecommendation);
  }

  async recordSnapshot(snapshot: BrainSnapshot, recommendationId: string): Promise<void> {
    await this.db.insert(profileRecommendationSnapshots).values({
      recommendationId,
      learnerId: snapshot.learnerId,
      beforeJson: snapshot.before,
      afterJson: snapshot.after,
    });
  }
}
