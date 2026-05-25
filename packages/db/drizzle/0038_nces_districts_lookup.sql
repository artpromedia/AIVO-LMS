-- 0038_nces_districts_lookup
--
-- Sprint A (completion plan) — REVISED.
--
-- Replaces the earlier 0037_zip_district_lookup migration which
-- collided with an existing `districts` table that already lives in
-- production (different schema: it uses `state_code` + `nces_district_id`,
-- not `state` + `nces_id`). The earlier migration's
--   CREATE TABLE IF NOT EXISTS districts (...)
-- silently no-op'd against the existing table, then
--   CREATE INDEX idx_districts_state ON districts(state)
-- errored because the column didn't match, and
--   CREATE TABLE zip_district (... REFERENCES districts(nces_id))
-- errored because the FK target column didn't exist.
--
-- The fix: rename the lookup tables to `nces_districts` and
-- `zip_nces_district` so there is no collision with the legacy
-- `districts` table. The orphan `idx_districts_name` index that
-- accidentally succeeded against the legacy table is dropped here.
--
-- This migration is additive and idempotent. Safe to run against
-- environments where 0037 was partially applied, fully applied, or
-- never applied.

DROP INDEX IF EXISTS idx_districts_name;
DROP INDEX IF EXISTS idx_districts_state;
DROP INDEX IF EXISTS idx_zip_district_zip;
DROP INDEX IF EXISTS idx_zip_district_dominant;
DROP TABLE IF EXISTS zip_district;
-- Intentionally NOT dropping a `districts` table — there is a legacy
-- districts table in production with a different schema that we must
-- not touch.

CREATE TABLE IF NOT EXISTS nces_districts (
  nces_id varchar(16) PRIMARY KEY,
  name varchar(255) NOT NULL,
  state varchar(2) NOT NULL,
  county_fips varchar(5),
  lea_type varchar(8),
  city varchar(100),
  website_url varchar(500),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nces_districts_state ON nces_districts(state);
CREATE INDEX IF NOT EXISTS idx_nces_districts_name ON nces_districts(name);

CREATE TABLE IF NOT EXISTS zip_nces_district (
  zip varchar(5) NOT NULL,
  nces_id varchar(16) NOT NULL REFERENCES nces_districts(nces_id),
  weight real NOT NULL DEFAULT 0,
  dominant boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (zip, nces_id)
);

CREATE INDEX IF NOT EXISTS idx_zip_nces_district_zip ON zip_nces_district(zip);
CREATE INDEX IF NOT EXISTS idx_zip_nces_district_dominant ON zip_nces_district(zip, dominant);
