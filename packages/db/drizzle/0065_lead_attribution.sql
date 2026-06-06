-- Lead lifecycle + campaign attribution columns on lead_submissions.
-- Idempotent so it is safe against dev DBs bootstrapped via db:push.
ALTER TABLE "lead_submissions" ADD COLUMN IF NOT EXISTS "grade_band" varchar(50);
ALTER TABLE "lead_submissions" ADD COLUMN IF NOT EXISTS "interest_area" varchar(100);
ALTER TABLE "lead_submissions" ADD COLUMN IF NOT EXISTS "utm_source" varchar(120);
ALTER TABLE "lead_submissions" ADD COLUMN IF NOT EXISTS "utm_medium" varchar(120);
ALTER TABLE "lead_submissions" ADD COLUMN IF NOT EXISTS "utm_campaign" varchar(120);
ALTER TABLE "lead_submissions" ADD COLUMN IF NOT EXISTS "coupon_code" varchar(64);
ALTER TABLE "lead_submissions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_lead_submissions_status" ON "lead_submissions" ("status");
