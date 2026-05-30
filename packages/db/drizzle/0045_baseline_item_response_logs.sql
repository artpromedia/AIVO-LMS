-- Per-item adaptive-baseline telemetry.
--
-- One row per administered baseline item, capturing the ability estimate
-- before/after the answer so the recalibration job can refine item
-- difficulty from live data. Append-only and aggregated per `item_key`
-- (`${skill_id}|${difficulty}`) across learners.
--
-- Denormalized id columns (varchar, no FK): this is a high-volume analytics
-- log written from web-v2's string id space, so it intentionally trades
-- referential integrity for write simplicity.
CREATE TABLE IF NOT EXISTS "baseline_item_response_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(128) NOT NULL,
  "learner_id" VARCHAR(128) NOT NULL,
  "baseline_id" VARCHAR(128) NOT NULL,
  "item_key" VARCHAR(160) NOT NULL,
  "skill_id" VARCHAR(128) NOT NULL,
  "subject_id" VARCHAR(128) NOT NULL,
  "question_id" VARCHAR(128) NOT NULL,
  "difficulty" VARCHAR(32) NOT NULL,
  "difficulty_theta" REAL NOT NULL,
  "correct" BOOLEAN NOT NULL,
  "skipped" BOOLEAN NOT NULL DEFAULT false,
  "theta_before" REAL NOT NULL,
  "theta_after" REAL NOT NULL,
  "latency_ms" INTEGER,
  "modality" VARCHAR(16) NOT NULL,
  "recorded_at" TIMESTAMP NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_bir_tenant"
  ON "baseline_item_response_logs" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_bir_tenant_item"
  ON "baseline_item_response_logs" ("tenant_id", "item_key");

CREATE INDEX IF NOT EXISTS "idx_bir_learner"
  ON "baseline_item_response_logs" ("learner_id");

CREATE INDEX IF NOT EXISTS "idx_bir_baseline"
  ON "baseline_item_response_logs" ("baseline_id");
