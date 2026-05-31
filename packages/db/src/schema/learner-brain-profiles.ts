/**
 * Learner brain-profile persistence (web-domain `LearnerBrainProfile`).
 *
 * Backs `BrainProfileStore` (apps/web-v2/lib/db/persistence/types.ts).
 * Distinct from brain-svc's canonical `brain_states` table: this stores
 * the web app's own profile-lifecycle domain object (pre_clone → cloned
 * → approved) verbatim. Same conventions as `lesson_runs`: app-generated
 * TEXT ids (no FK), ISO-8601 TEXT timestamps, heavy state in JSONB.
 */
import { pgTable, text, boolean, jsonb, index } from "drizzle-orm/pg-core";

export const learnerBrainProfiles = pgTable(
  "learner_brain_profiles",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    approvalStatus: text("approval_status"),
    cloneStage: text("clone_stage"),
    approvedByParent: boolean("approved_by_parent").notNull().default(false),
    clonedAt: text("cloned_at"),
    generatedAt: text("generated_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    /** LearnerBrainProfileState payload. */
    state: jsonb("state").notNull().default({}),
  },
  (t) => ({
    learnerIdx: index("learner_brain_profiles_learner_idx").on(t.learnerId, t.tenantId),
  }),
);
