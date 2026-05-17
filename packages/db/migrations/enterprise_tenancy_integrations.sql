-- Sprint 08: Enterprise tenancy + SIS / LTI integration tables (additive).
-- All tables are new; existing learner / tenant tables are untouched.

CREATE TABLE IF NOT EXISTS enterprise_districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  external_id varchar(120),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enterprise_districts_external ON enterprise_districts(external_id);

CREATE TABLE IF NOT EXISTS enterprise_schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id uuid NOT NULL,
  name text NOT NULL,
  external_id varchar(120),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enterprise_schools_district ON enterprise_schools(district_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_schools_external ON enterprise_schools(external_id);

CREATE TABLE IF NOT EXISTS enterprise_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  name text NOT NULL,
  external_id varchar(120),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enterprise_classes_school ON enterprise_classes(school_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_classes_external ON enterprise_classes(external_id);

CREATE TABLE IF NOT EXISTS class_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class ON class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_learner ON class_enrollments(learner_id);

CREATE TABLE IF NOT EXISTS teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  teacher_user_id uuid NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_class ON teacher_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON teacher_assignments(teacher_user_id);

CREATE TABLE IF NOT EXISTS district_admin_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role varchar(40) NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_district_admin_assignments_district ON district_admin_assignments(district_id);
CREATE INDEX IF NOT EXISTS idx_district_admin_assignments_user ON district_admin_assignments(user_id);

CREATE TABLE IF NOT EXISTS enterprise_sis_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id uuid NOT NULL,
  vendor varchar(50) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'inactive',
  metadata_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enterprise_sis_conn_district ON enterprise_sis_connections(district_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_sis_conn_vendor ON enterprise_sis_connections(vendor);

CREATE TABLE IF NOT EXISTS enterprise_sis_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id uuid NOT NULL,
  connection_id uuid,
  status varchar(30) NOT NULL DEFAULT 'queued',
  schools_count integer DEFAULT 0,
  classes_count integer DEFAULT 0,
  students_count integer DEFAULT 0,
  enrollments_count integer DEFAULT 0,
  warnings_json jsonb DEFAULT '[]'::jsonb,
  error_message text,
  started_at timestamp NOT NULL DEFAULT now(),
  completed_at timestamp
);
CREATE INDEX IF NOT EXISTS idx_enterprise_sis_jobs_district ON enterprise_sis_import_jobs(district_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_sis_jobs_status ON enterprise_sis_import_jobs(status);

CREATE TABLE IF NOT EXISTS enterprise_lti_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id uuid,
  issuer text NOT NULL,
  client_id text NOT NULL,
  deployment_id text,
  metadata_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enterprise_lti_tools_district ON enterprise_lti_tools(district_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_lti_tools_issuer ON enterprise_lti_tools(issuer);

CREATE TABLE IF NOT EXISTS enterprise_lti_launches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid,
  learner_id uuid,
  context_id text,
  resource_link_id text,
  status varchar(30) NOT NULL DEFAULT 'validated',
  issues_json jsonb DEFAULT '[]'::jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enterprise_lti_launches_tool ON enterprise_lti_launches(tool_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_lti_launches_learner ON enterprise_lti_launches(learner_id);

-- Down migration (manual rollback):
-- DROP TABLE IF EXISTS enterprise_lti_launches;
-- DROP TABLE IF EXISTS enterprise_lti_tools;
-- DROP TABLE IF EXISTS enterprise_sis_import_jobs;
-- DROP TABLE IF EXISTS enterprise_sis_connections;
-- DROP TABLE IF EXISTS district_admin_assignments;
-- DROP TABLE IF EXISTS teacher_assignments;
-- DROP TABLE IF EXISTS class_enrollments;
-- DROP TABLE IF EXISTS enterprise_classes;
-- DROP TABLE IF EXISTS enterprise_schools;
-- DROP TABLE IF EXISTS enterprise_districts;
