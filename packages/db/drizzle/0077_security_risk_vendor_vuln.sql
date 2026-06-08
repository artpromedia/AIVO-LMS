-- Security posture: risk register, vendor risk management, and vulnerability
-- reports. Owned by admin-svc, surfaced in the web-admin platform security
-- console. Additive only.

CREATE TABLE IF NOT EXISTS "security_risks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" VARCHAR(256) NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "category" VARCHAR(24) NOT NULL DEFAULT 'security',
  "inherent_severity" VARCHAR(16) NOT NULL DEFAULT 'medium',
  "residual_severity" VARCHAR(16) NOT NULL DEFAULT 'medium',
  "treatment" VARCHAR(16) NOT NULL DEFAULT 'mitigate',
  "owner" VARCHAR(128) NOT NULL DEFAULT '',
  "open" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_risks_category" ON "security_risks" ("category");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_vendors" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(256) NOT NULL,
  "category" VARCHAR(24) NOT NULL DEFAULT 'other',
  "data_residency" VARCHAR(64) NOT NULL DEFAULT '',
  "processes_learner_data" BOOLEAN NOT NULL DEFAULT false,
  "dpa_signed" BOOLEAN NOT NULL DEFAULT false,
  "risk_tier" VARCHAR(8) NOT NULL DEFAULT 'tier3',
  "approved" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "last_reviewed_at" TIMESTAMP NOT NULL DEFAULT now(),
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_vendors_risk_tier" ON "security_vendors" ("risk_tier");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_vulnerabilities" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" VARCHAR(256) NOT NULL,
  "cve_id" VARCHAR(64),
  "severity" VARCHAR(16) NOT NULL DEFAULT 'medium',
  "status" VARCHAR(16) NOT NULL DEFAULT 'open',
  "source" VARCHAR(24) NOT NULL DEFAULT 'internal',
  "affected_component" VARCHAR(256) NOT NULL DEFAULT '',
  "fixed_in" VARCHAR(128),
  "discovered_at" TIMESTAMP NOT NULL DEFAULT now(),
  "resolved_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_vulnerabilities_status" ON "security_vulnerabilities" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_vulnerabilities_severity" ON "security_vulnerabilities" ("severity");
