-- Additional roles a user may act as beyond users.role (ADR 0020 single
-- shell, multi-role). availableRoles in the JWT = users.role ∪ user_roles.role;
-- the unified app's role switcher validates the active-role header against it.

CREATE TABLE IF NOT EXISTS "user_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "tenant_id" uuid NOT NULL,
  "role" varchar(40) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_roles_user_role_key" UNIQUE ("user_id", "role")
);
CREATE INDEX IF NOT EXISTS "user_roles_user_idx" ON "user_roles" ("user_id");
