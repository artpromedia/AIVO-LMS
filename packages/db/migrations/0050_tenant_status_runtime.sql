BEGIN;

CREATE TABLE IF NOT EXISTS tenant_service_districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  external_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_service_schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES tenant_service_districts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  external_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (district_id, external_id)
);
CREATE INDEX IF NOT EXISTS tenant_service_schools_district_idx ON tenant_service_schools(district_id);

CREATE TABLE IF NOT EXISTS tenant_service_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES tenant_service_districts(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES tenant_service_schools(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  external_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (district_id, external_id)
);
CREATE INDEX IF NOT EXISTS tenant_service_classes_school_idx ON tenant_service_classes(school_id);

CREATE TABLE IF NOT EXISTS tenant_roster_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES tenant_service_districts(id) ON DELETE CASCADE,
  external_id VARCHAR(255) NOT NULL,
  given_name VARCHAR(255) NOT NULL,
  family_name VARCHAR(255) NOT NULL,
  school_external_id VARCHAR(255) NOT NULL,
  grade VARCHAR(32),
  parent_owned_fields JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (district_id, external_id)
);

CREATE TABLE IF NOT EXISTS tenant_roster_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES tenant_service_districts(id) ON DELETE CASCADE,
  external_id VARCHAR(255) NOT NULL,
  given_name VARCHAR(255) NOT NULL,
  family_name VARCHAR(255) NOT NULL,
  email VARCHAR(320),
  school_external_ids JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (district_id, external_id)
);

CREATE TABLE IF NOT EXISTS tenant_roster_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES tenant_service_districts(id) ON DELETE CASCADE,
  class_external_id VARCHAR(255) NOT NULL,
  student_external_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (district_id, class_external_id, student_external_id)
);
CREATE INDEX IF NOT EXISTS tenant_roster_enrollment_student_idx
  ON tenant_roster_enrollments(district_id, student_external_id);

CREATE TABLE IF NOT EXISTS service_runtime_state (
  service TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
