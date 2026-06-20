import { pgTable, uuid, text, doublePrecision, integer, jsonb, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

/**
 * Per-skill knowledge-tracing state, owned by mastery-svc (the local BKT/DKT model).
 *
 * Replaces the per-subject float dict on `brain_states.mastery_levels` as the system of
 * record for "what the learner knows": one row per (learner, skill) with the model's
 * mastery probability `p`, its logit `theta` (which feeds @aivo/scoring deliveryLevelFromTheta),
 * a rolling trend, and the model version that produced it. The brain-state subject dict is kept
 * as a derived read-through aggregate for back-compat.
 */
export const learnerSkillMastery = pgTable(
  "learner_skill_mastery",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    learnerId: uuid("learner_id").notNull(),
    // Nullable: mastery-svc may observe before a tenant is resolved; callers pass it when known.
    tenantId: uuid("tenant_id"),
    skillId: text("skill_id").notNull(),
    subject: text("subject").notNull(),
    /** P(skill mastered), 0..1 — the BKT posterior. */
    pMastery: doublePrecision("p_mastery").notNull().default(0),
    /** logit(pMastery) — the ability estimate placement consumes. */
    theta: doublePrecision("theta").notNull().default(0),
    /** Cold-start prior used when the skill was first seen (for explainability). */
    pInit: doublePrecision("p_init").notNull().default(0),
    nObs: integer("n_obs").notNull().default(0),
    /** rising | stable | declining over the last-N posteriors. */
    lastTrend: text("last_trend").notNull().default("stable"),
    recentP: jsonb("recent_p").notNull().default([]),
    modelVersion: text("model_version").notNull().default("bkt-v1"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_learner_skill_mastery").on(t.learnerId, t.skillId),
    index("idx_lsm_learner").on(t.learnerId),
  ],
);

/**
 * Append-only graded-answer log. Two jobs: (1) idempotency — `eventId` is unique so an
 * at-least-once sender replaying an observation is a no-op; (2) the interaction history a
 * future DKT model trains on (skill + correctness + coarse latency, no PII).
 */
export const masteryObservations = pgTable(
  "mastery_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    learnerId: uuid("learner_id").notNull(),
    tenantId: uuid("tenant_id"),
    skillId: text("skill_id").notNull(),
    subject: text("subject"),
    correct: boolean("correct").notNull(),
    difficulty: text("difficulty"),
    latencyMs: integer("latency_ms"),
    source: text("source"),
    eventId: text("event_id").unique(),
    modelVersion: text("model_version"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_mobs_learner").on(t.learnerId)],
);
