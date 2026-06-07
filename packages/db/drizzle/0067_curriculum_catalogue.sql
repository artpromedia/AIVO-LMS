-- 0067_curriculum_catalogue.sql
-- Durable persistence for the curriculum catalogue authoring/CMS write path
-- (Sprint 4). curriculum-svc reads through these tables when
-- CURRICULUM_PERSISTENCE=postgres. All statements are guarded so the
-- migration is idempotent (safe to apply more than once).

CREATE TABLE IF NOT EXISTS curriculum_frameworks (
  country             varchar(8)   PRIMARY KEY,
  framework           varchar(256) NOT NULL,
  standards_code      varchar(64)  NOT NULL,
  grade_band_scheme   varchar(64)  NOT NULL DEFAULT '',
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS curriculum_jurisdictions (
  id          varchar(128) PRIMARY KEY,
  name        varchar(256) NOT NULL,
  state       varchar(64)  NOT NULL DEFAULT '',
  country     varchar(8)   NOT NULL DEFAULT 'US',
  region      varchar(128),
  zip_codes   jsonb        NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS curriculum_jurisdictions_country_region_idx
  ON curriculum_jurisdictions (country, region);

CREATE TABLE IF NOT EXISTS curriculum_skills (
  id          varchar(128) PRIMARY KEY,
  subject     varchar(64)  NOT NULL,
  grade_band  varchar(32)  NOT NULL,
  label       text         NOT NULL DEFAULT '',
  summary     text         NOT NULL DEFAULT '',
  source      text         NOT NULL DEFAULT '',
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS curriculum_skills_subject_grade_idx
  ON curriculum_skills (subject, grade_band);

CREATE TABLE IF NOT EXISTS curriculum_skill_prereqs (
  skill_id         varchar(128) NOT NULL REFERENCES curriculum_skills (id) ON DELETE CASCADE,
  prereq_skill_id  varchar(128) NOT NULL,
  PRIMARY KEY (skill_id, prereq_skill_id)
);

CREATE TABLE IF NOT EXISTS curriculum_content_packs (
  id              varchar(128) PRIMARY KEY,
  title           varchar(256) NOT NULL,
  subject         varchar(64)  NOT NULL,
  grade_band      varchar(32)  NOT NULL,
  framework_code  varchar(64)  NOT NULL DEFAULT '',
  district_ids    jsonb        NOT NULL DEFAULT '[]'::jsonb,
  skill_ids       jsonb        NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS curriculum_content_packs_subject_grade_idx
  ON curriculum_content_packs (subject, grade_band);
