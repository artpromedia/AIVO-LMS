-- Security incident register + bridge ownership. Owned by admin-svc,
-- surfaced in the web-admin platform security console. Additive only.

CREATE TABLE IF NOT EXISTS "security_incidents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" VARCHAR(256) NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "severity" VARCHAR(8) NOT NULL DEFAULT 'sev3',
  "status" VARCHAR(24) NOT NULL DEFAULT 'open',
  "commander_user_id" UUID,
  "customer_impact" BOOLEAN NOT NULL DEFAULT false,
  "regulator_notification_required" BOOLEAN NOT NULL DEFAULT false,
  "detected_at" TIMESTAMP NOT NULL DEFAULT now(),
  "resolved_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_incidents_status" ON "security_incidents" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_incidents_severity" ON "security_incidents" ("severity");
