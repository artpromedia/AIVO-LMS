/**
 * Sprint C-06 — dedicated approval-record store for a learner's brain
 * profile.
 *
 * The single most consequential parent act in the product (approve / amend /
 * decline a child's learning profile) is recorded here as queryable audit
 * evidence — actor, action, consent version, RAI version, the reviewed profile
 * revision, folded modifications, and a hashed request IP — instead of being
 * buried in the profile's display JSON.
 *
 * Same conventions as `learner_brain_profiles`: app-generated TEXT ids (no FK),
 * ISO-8601 TEXT timestamps, JSONB for the variable-shape `modifications`
 * payload. Append-only: one row per parent decision.
 */
import { pgTable, text, integer, jsonb, index } from "drizzle-orm/pg-core";

export const brainProfileApprovals = pgTable(
  "brain_profile_approvals",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    learnerId: text("learner_id").notNull(),
    brainProfileId: text("brain_profile_id").notNull(),
    profileRevision: integer("profile_revision").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    /** approved | amended | declined */
    action: text("action").notNull(),
    consentVersion: text("consent_version").notNull(),
    raiVersion: text("rai_version").notNull(),
    /** ParentModification[] folded at approval (C-05 shape); [] otherwise. */
    modifications: jsonb("modifications").notNull().default([]),
    /** SHA-256 of the request IP — raw IP is never stored. */
    ipHash: text("ip_hash"),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    learnerIdx: index("brain_profile_approvals_learner_idx").on(t.learnerId, t.tenantId),
  }),
);
