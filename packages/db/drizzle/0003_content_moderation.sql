CREATE TYPE "public"."moderation_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'ESCALATED', 'LOW_CONFIDENCE');--> statement-breakpoint
CREATE TABLE "content_moderation_log" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid,
        "learner_id" uuid,
        "session_id" uuid,
        "content_type" varchar(50) NOT NULL,
        "content" text NOT NULL,
        "flag_reason" varchar(100) NOT NULL,
        "flag_confidence" numeric(4, 3),
        "gate_results" jsonb,
        "tutor_sku" varchar(100),
        "model_used" varchar(100),
        "status" "moderation_status" DEFAULT 'PENDING' NOT NULL,
        "reviewed_by" uuid,
        "reviewed_at" timestamp,
        "review_notes" text,
        "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "moderation_policies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid,
        "name" varchar(255) NOT NULL,
        "patterns" jsonb NOT NULL,
        "action" varchar(20) DEFAULT 'flag' NOT NULL,
        "enabled" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "content_moderation_log" ADD CONSTRAINT "content_moderation_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_moderation_log" ADD CONSTRAINT "content_moderation_log_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_policies" ADD CONSTRAINT "moderation_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_moderation_log_status" ON "content_moderation_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_moderation_log_created" ON "content_moderation_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_moderation_log_tenant" ON "content_moderation_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_moderation_log_tutor" ON "content_moderation_log" USING btree ("tutor_sku");--> statement-breakpoint
CREATE INDEX "idx_moderation_policies_tenant" ON "moderation_policies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_moderation_policies_enabled" ON "moderation_policies" USING btree ("enabled");
