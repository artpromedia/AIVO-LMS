-- Named district pilot programs + daily learner-progress snapshot for the
-- district overview. Hand-written, idempotent (safe on fresh or partially
-- db:push'd databases). See packages/db/src/schema/pilots.ts.

CREATE TABLE IF NOT EXISTS pilot_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name varchar(255) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'active',
  focus_area varchar(120),
  description text,
  lead_school_id uuid REFERENCES schools(id),
  enrolled_learners integer NOT NULL DEFAULT 0,
  started_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pilot_programs_tenant ON pilot_programs (tenant_id, status);

CREATE TABLE IF NOT EXISTS pilot_program_schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES pilot_programs(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pilot_program_schools_unique
  ON pilot_program_schools (program_id, school_id);

CREATE TABLE IF NOT EXISTS district_mastery_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  day date NOT NULL,
  mastery integer NOT NULL DEFAULT 0,
  on_track integer NOT NULL DEFAULT 0,
  at_risk integer NOT NULL DEFAULT 0,
  needs_support integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_district_mastery_daily_unique
  ON district_mastery_daily (tenant_id, day);
