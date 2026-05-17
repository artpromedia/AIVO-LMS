import {
  boolean,
  index,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const profileRecommendationsV2 = pgTable(
  "profile_recommendations_v2",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    learnerId: uuid("learner_id").notNull(),
    tenantId: uuid("tenant_id"),
    type: varchar("type", { length: 80 }).notNull(),
    title: text("title").notNull(),
    parentSummary: text("parent_summary").notNull(),
    currentValue: jsonb("current_value"),
    proposedValue: jsonb("proposed_value"),
    amendedValue: jsonb("amended_value"),
    confidence: real("confidence").notNull(),
    evidenceJson: jsonb("evidence_json").default([]),
    requiresParentApproval: boolean("requires_parent_approval").default(true).notNull(),
    affectsIep: boolean("affects_iep").default(false).notNull(),
    affectsInstructionalAccess: boolean("affects_instructional_access").default(false).notNull(),
    reversible: boolean("reversible").default(true).notNull(),
    status: varchar("status", { length: 30 }).default("PENDING").notNull(),
    declineReason: text("decline_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    appliedAt: timestamp("applied_at"),
  },
  (table) => [
    index("idx_recommendations_v2_learner").on(table.learnerId),
    index("idx_recommendations_v2_status").on(table.status),
    index("idx_recommendations_v2_type").on(table.type),
    index("idx_recommendations_v2_tenant").on(table.tenantId),
  ],
);

export const profileRecommendationSnapshots = pgTable(
  "profile_recommendation_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recommendationId: uuid("recommendation_id").notNull(),
    learnerId: uuid("learner_id").notNull(),
    beforeJson: jsonb("before_json").default({}),
    afterJson: jsonb("after_json").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_recommendation_snapshots_rec").on(table.recommendationId),
    index("idx_recommendation_snapshots_learner").on(table.learnerId),
  ],
);
