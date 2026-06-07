-- Canonical Drizzle migration for tenant-service runtime persistence and
-- request idempotency. The same changes originally existed only in
-- packages/db/migrations, which is not consumed by the Drizzle migrator.

CREATE TABLE IF NOT EXISTS "tenant_service_districts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"external_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_service_district_external_id_uq" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_service_schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"district_id" uuid NOT NULL REFERENCES "tenant_service_districts"("id") ON DELETE cascade,
	"name" varchar(255) NOT NULL,
	"external_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_service_school_external_id_uq" UNIQUE("district_id", "external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_service_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"district_id" uuid NOT NULL REFERENCES "tenant_service_districts"("id") ON DELETE cascade,
	"school_id" uuid NOT NULL REFERENCES "tenant_service_schools"("id") ON DELETE cascade,
	"name" varchar(255) NOT NULL,
	"external_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_service_class_external_id_uq" UNIQUE("district_id", "external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_roster_students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"district_id" uuid NOT NULL REFERENCES "tenant_service_districts"("id") ON DELETE cascade,
	"external_id" varchar(255) NOT NULL,
	"given_name" varchar(255) NOT NULL,
	"family_name" varchar(255) NOT NULL,
	"school_external_id" varchar(255) NOT NULL,
	"grade" varchar(32),
	"parent_owned_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_roster_student_external_id_uq" UNIQUE("district_id", "external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_roster_teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"district_id" uuid NOT NULL REFERENCES "tenant_service_districts"("id") ON DELETE cascade,
	"external_id" varchar(255) NOT NULL,
	"given_name" varchar(255) NOT NULL,
	"family_name" varchar(255) NOT NULL,
	"email" varchar(320),
	"school_external_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_roster_teacher_external_id_uq" UNIQUE("district_id", "external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_roster_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"district_id" uuid NOT NULL REFERENCES "tenant_service_districts"("id") ON DELETE cascade,
	"class_external_id" varchar(255) NOT NULL,
	"student_external_id" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_roster_enrollment_external_ids_uq" UNIQUE("district_id", "class_external_id", "student_external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_runtime_state" (
	"service" text PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "idempotency_keys" (
	"tenant_id" text NOT NULL,
	"route" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"response_body" jsonb NOT NULL,
	"response_status" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_keys_tenant_route_key_uq" UNIQUE("tenant_id", "route", "idempotency_key")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_service_schools_district_idx" ON "tenant_service_schools" USING btree ("district_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_service_classes_school_idx" ON "tenant_service_classes" USING btree ("school_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_roster_enrollment_student_idx" ON "tenant_roster_enrollments" USING btree ("district_id", "student_external_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idempotency_keys_expires_at_idx" ON "idempotency_keys" USING btree ("expires_at");
--> statement-breakpoint
ALTER TABLE "homework_sessions" ADD COLUMN IF NOT EXISTS "runtime_state" jsonb DEFAULT '{}'::jsonb NOT NULL;
