-- Security posture: SOC 2 / Trust Services control register + evidence.
-- Owned by admin-svc, surfaced in the web-admin platform console. Replaces
-- the in-memory store the legacy web-v2 admin used. Additive only.

CREATE TABLE IF NOT EXISTS "security_controls" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(64) NOT NULL,
  "title" VARCHAR(256) NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "criterion" VARCHAR(32) NOT NULL DEFAULT 'security',
  "owner" VARCHAR(128) NOT NULL DEFAULT '',
  "status" VARCHAR(24) NOT NULL DEFAULT 'not_started',
  "last_reviewed_at" TIMESTAMP NOT NULL DEFAULT now(),
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_controls_criterion" ON "security_controls" ("criterion");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_controls_status" ON "security_controls" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_control_evidence" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "control_id" UUID NOT NULL REFERENCES "security_controls"("id") ON DELETE CASCADE,
  "kind" VARCHAR(24) NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "uri" TEXT,
  "collected_by_user_id" UUID,
  "collected_at" TIMESTAMP NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_control_evidence_control" ON "security_control_evidence" ("control_id");
