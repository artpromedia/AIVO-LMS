-- 0068_term_syllabus.sql
-- Whole-term / trimester syllabus ingestion (Sprint 6, G7). A parent/teacher
-- uploads a full-term syllabus per subject; it is parsed into ordered units
-- the pacing engine explodes into dated weekly foci. Idempotent (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS term_syllabi (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid REFERENCES tenants (id),
  learner_id     uuid NOT NULL REFERENCES learners (id) ON DELETE CASCADE,
  uploaded_by    uuid NOT NULL REFERENCES users (id),
  uploader_role  varchar(32)  NOT NULL,
  subject        varchar(64)  NOT NULL,
  title          varchar(255),
  term_count     integer      NOT NULL DEFAULT 1,
  source_type    varchar(16)  NOT NULL DEFAULT 'text',
  file_name      varchar(255),
  raw_text       text,
  status         varchar(24)  NOT NULL DEFAULT 'PARSED',
  notes          text,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS term_syllabi_learner_subject_idx ON term_syllabi (learner_id, subject);
CREATE INDEX IF NOT EXISTS term_syllabi_status_idx ON term_syllabi (status);

CREATE TABLE IF NOT EXISTS term_syllabus_units (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syllabus_id     uuid NOT NULL REFERENCES term_syllabi (id) ON DELETE CASCADE,
  term_number     integer      NOT NULL DEFAULT 1,
  order_index     integer      NOT NULL,
  title           varchar(255) NOT NULL,
  duration_weeks  integer      NOT NULL DEFAULT 1,
  topics          jsonb        NOT NULL DEFAULT '[]'::jsonb,
  objectives      jsonb        NOT NULL DEFAULT '[]'::jsonb,
  standards       jsonb        NOT NULL DEFAULT '[]'::jsonb,
  vocabulary      jsonb        NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS term_syllabus_units_syllabus_idx
  ON term_syllabus_units (syllabus_id, order_index);
