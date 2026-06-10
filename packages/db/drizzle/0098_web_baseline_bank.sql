-- 0098_web_baseline_bank.sql
--
-- Closes the check:schema-drift finding: web_baseline_bank (the daily-grown
-- baseline item bank, src/schema/web-standards.ts) was declared without a
-- migration. Platform-global reference data => no RLS, like the
-- web_standards tables in 0089. aivo_app covered by 0050's schema-wide grant
-- on provisioned environments.

CREATE TABLE IF NOT EXISTS "web_baseline_bank" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
