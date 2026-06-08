-- Support ticket queue. Owned by admin-svc, surfaced in the web-admin
-- platform console. Additive only.

CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID,
  "user_id" UUID,
  "subject" VARCHAR(256) NOT NULL,
  "body" TEXT NOT NULL DEFAULT '',
  "status" VARCHAR(16) NOT NULL DEFAULT 'open',
  "assignee_id" UUID,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_support_tickets_status" ON "support_tickets" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_support_tickets_tenant" ON "support_tickets" ("tenant_id");
