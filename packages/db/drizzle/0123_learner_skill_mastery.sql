-- mastery-svc: local knowledge-tracing model state (P0).
-- Per-skill mastery (system of record for "what the learner knows") + an append-only
-- observation log (idempotency key + future DKT training data).
CREATE TABLE IF NOT EXISTS "learner_skill_mastery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"tenant_id" uuid,
	"skill_id" text NOT NULL,
	"subject" text NOT NULL,
	"p_mastery" double precision DEFAULT 0 NOT NULL,
	"theta" double precision DEFAULT 0 NOT NULL,
	"p_init" double precision DEFAULT 0 NOT NULL,
	"n_obs" integer DEFAULT 0 NOT NULL,
	"last_trend" text DEFAULT 'stable' NOT NULL,
	"recent_p" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model_version" text DEFAULT 'bkt-v1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mastery_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"tenant_id" uuid,
	"skill_id" text NOT NULL,
	"subject" text,
	"correct" boolean NOT NULL,
	"difficulty" text,
	"latency_ms" integer,
	"source" text,
	"event_id" text,
	"model_version" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mastery_observations_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_learner_skill_mastery" ON "learner_skill_mastery" USING btree ("learner_id","skill_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lsm_learner" ON "learner_skill_mastery" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_mobs_learner" ON "mastery_observations" USING btree ("learner_id");
