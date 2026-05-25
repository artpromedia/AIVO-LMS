-- 0037_zip_district_lookup
--
-- Sprint A (completion plan): real zip → school district auto-lookup.
--
-- Replaces the static 21-major-district map in
-- services/identity-svc/src/services/curriculum-lookup.ts with a
-- database-backed resolver seeded from NCES CCD (`ccd_lea_*`) and EDGE
-- (`EDGE_GEOCODE_PUBLICLEA_*`) public data. See
-- scripts/seed-nces-districts.mjs.
--
-- The tables are additive; no other table is modified. Existing
-- parent/learner flows that do not collect zip continue to work
-- unchanged because the resolver gracefully returns null on empty
-- inputs and the curriculum-lookup falls back to state-level mapping.

CREATE TABLE IF NOT EXISTS districts (
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

CREATE INDEX IF NOT EXISTS idx_districts_state ON districts(state);
CREATE INDEX IF NOT EXISTS idx_districts_name ON districts(name);

CREATE TABLE IF NOT EXISTS zip_district (
  zip varchar(5) NOT NULL,
  nces_id varchar(16) NOT NULL REFERENCES districts(nces_id),
  weight real NOT NULL DEFAULT 0,
  dominant boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (zip, nces_id)
);

CREATE INDEX IF NOT EXISTS idx_zip_district_zip ON zip_district(zip);
CREATE INDEX IF NOT EXISTS idx_zip_district_dominant ON zip_district(zip, dominant);
