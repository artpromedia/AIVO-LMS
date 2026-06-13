/**
 * Sprint C-13 — the brain-profile CHANGE record store.
 *
 * The Learning Brain stops changing silently: every structural mutation
 * (functioning level, accommodations added/removed, tutor activation, an
 * IEP-derived shift) and every mastery move is recorded here as one append-only
 * row, newest-first on the parent's "what changed since you approved" timeline.
 * Structural rows carry `requires_ack = true` and notify the parent; mastery
 * rows carry `requires_ack = false` and flow freely (cheap, just enables the
 * timeline). The `acked_at` column is the one mutable field — set when the
 * parent acknowledges a structural delta.
 *
 * Same conventions as `brain_profile_approvals` (its sibling): app-generated
 * TEXT ids (no FK), ISO-8601 TEXT timestamps, JSONB for the variable-shape
 * `fields` array. Anchored to the same `revision` the approval record keys off,
 * so the timeline can interleave changes and approvals on one spine.
 */
import { pgTable, text, integer, jsonb, boolean, index } from "drizzle-orm/pg-core";

export const brainProfileChanges = pgTable(
  "brain_profile_changes",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    learnerId: text("learner_id").notNull(),
    brainProfileId: text("brain_profile_id").notNull(),
    /** The LearnerBrainProfile.revision this change produced. */
    revision: integer("revision").notNull(),
    /** mastery | structural */
    kind: text("kind").notNull(),
    /** string[] of changed field paths (e.g. ["accommodation.read_aloud"]). */
    fields: jsonb("fields").notNull().default([]),
    /** Plain-language, strengths-first summary of what changed and why. */
    summary: text("summary").notNull(),
    /** baseline_reclone | regenerate | iep_update | engagement_sync | regression_detected | amendment | rollback */
    source: text("source").notNull(),
    /** True only for structural changes — the parent must acknowledge the delta. */
    requiresAck: boolean("requires_ack").notNull().default(false),
    /** ISO-8601 timestamp when the parent acknowledged the delta; null while pending. */
    ackedAt: text("acked_at"),
    /** ISO-8601 timestamp when the 7-day digest reminder was sent (the comms-svc
     *  reminder job's per-change latch — one reminder per change). Null until
     *  latched; only ever set for structural (requires_ack) rows. */
    reminderSentAt: text("reminder_sent_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    learnerIdx: index("brain_profile_changes_learner_idx").on(t.learnerId, t.tenantId),
  }),
);
