/**
 * Sprint C-16 — the contributor acknowledgement record store.
 *
 * The orchestration loop closes from the contributor's side: when a parent
 * APPROVES a brain profile (the honest "your input is now in use" trigger —
 * folding alone isn't), one row is written here per contributor whose OWN input
 * was folded, naming the contributor's own folded supports/tutors and the
 * learner's first name. It powers three things at once:
 *
 *   1. Idempotency — the natural key (learner_id, profile_revision, role,
 *      contributor_email) makes re-approving the same revision a no-op; a later
 *      revision whose fold newly changed this contributor's input earns a fresh
 *      row.
 *   2. The "Your contributions" summary card's acknowledged date + the
 *      contributor's own folded items.
 *   3. The repeat-contribution retention metric's data spine.
 *
 * PRIVACY: `folded_items` carries ONLY the contributor's own role+domain-derived
 * decisions (their reasoning snippet + a support display label) — never another
 * contributor's content, never the child's levels/diagnoses. Content-safety
 * tested per template.
 *
 * Same conventions as `brain_profile_changes` (0115) and
 * `brain_profile_approvals` (0108), its siblings: app-generated TEXT ids (no
 * FK), ISO-8601 TEXT timestamps, JSONB for the variable-shape `folded_items`
 * array. RLS NOT applied — tenant scoping is in app code via the indexed
 * tenant_id column (the same exclusion 0050 makes for web_users /
 * web_audit_logs).
 */
import { pgTable, text, integer, jsonb, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";

export const contributionAcknowledgements = pgTable(
  "contribution_acknowledgements",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    learnerId: text("learner_id").notNull(),
    brainProfileId: text("brain_profile_id").notNull(),
    /** The reviewed LearnerBrainProfile.revision — the idempotency key's third
     *  component. */
    profileRevision: integer("profile_revision").notNull(),
    /** teacher | caregiver | therapist */
    role: text("role").notNull(),
    /** The contributor's account once they have one (account-holding
     *  contributors get the in-app notification); null for an email-only
     *  invitee. */
    contributorUserId: text("contributor_user_id"),
    /** Lowercased invitee email — the stable identity + idempotency component. */
    contributorEmail: text("contributor_email").notNull(),
    /** The learner's first name (the only learner datum the note may name). */
    learnerFirstName: text("learner_first_name").notNull(),
    /** ContributionFoldedItem[] — the contributor's OWN folded contributions. */
    foldedItems: jsonb("folded_items").notNull().default([]),
    /** ISO-8601 timestamp the acknowledgement was recorded (== approval time). */
    acknowledgedAt: text("acknowledged_at").notNull(),
    notifiedInApp: boolean("notified_in_app").notNull().default(false),
    notifiedEmail: boolean("notified_email").notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    learnerIdx: index("contribution_acknowledgements_learner_idx").on(t.learnerId, t.tenantId),
    contributorIdx: index("contribution_acknowledgements_contributor_idx").on(
      t.contributorEmail,
      t.tenantId,
    ),
    // The idempotency key: one acknowledgement per contributor per revision per
    // learner per role. A duplicate insert is rejected by the unique index, so a
    // re-approval of the same revision never produces a second row.
    idemKey: uniqueIndex("contribution_acknowledgements_idem_key").on(
      t.learnerId,
      t.profileRevision,
      t.role,
      t.contributorEmail,
    ),
  }),
);
