-- Sprint 3 (invite-flows) — teachers can invite parents.
--
-- Today only parents can invite teachers (learner_teachers, parent-initiated).
-- This table is the inverse: a teacher who already has a learner on their
-- classroom roster can invite that learner's parent to connect, so the
-- learnerTeachers ACCEPTED row is created without the parent having to
-- discover the teacher first.
--
-- For this first cut the invite always targets an existing learner:
-- learner_id is NOT NULL, and on accept we verify learners.parent_id
-- matches the accepting user. A future iteration may relax this to allow
-- inviting a parent whose learner doesn't yet exist in AIVO (mode b in
-- the audit doc) — child_first_name / child_last_name are kept for that
-- forward case and surfaced in the email today.
CREATE TABLE IF NOT EXISTS "teacher_parent_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "teacher_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "classroom_id" uuid REFERENCES "classrooms"("id"),
  "learner_id" uuid NOT NULL REFERENCES "learners"("id"),
  "parent_email" varchar(255) NOT NULL,
  "child_first_name" varchar(120),
  "child_last_name" varchar(120),
  "notes" text,
  "status" varchar(20) NOT NULL DEFAULT 'PENDING',
  "token_hash" varchar(128) NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "accepted_at" timestamp,
  "accepted_user_id" uuid REFERENCES "users"("id"),
  "revoked_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_teacher_parent_invites_teacher"
  ON "teacher_parent_invites" ("teacher_user_id");
CREATE INDEX IF NOT EXISTS "idx_teacher_parent_invites_learner"
  ON "teacher_parent_invites" ("learner_id");
CREATE INDEX IF NOT EXISTS "idx_teacher_parent_invites_email"
  ON "teacher_parent_invites" ("parent_email");
CREATE INDEX IF NOT EXISTS "idx_teacher_parent_invites_tenant"
  ON "teacher_parent_invites" ("tenant_id");
