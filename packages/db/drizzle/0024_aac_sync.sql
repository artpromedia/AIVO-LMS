-- Migration 0024: AAC sync state and family settings
-- Sprint 20 Phase 2

CREATE TYPE aac_vendor AS ENUM ('coughdrop', 'proloquo2go', 'snap_core', 'lamp');
CREATE TYPE aac_sync_status AS ENUM ('synced', 'pending', 'error', 'never');

CREATE TABLE aac_sync_state (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id      UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  vendor          aac_vendor NOT NULL,
  external_board_id VARCHAR(255),
  last_sync_at    TIMESTAMP,
  sync_status     aac_sync_status NOT NULL DEFAULT 'never',
  error_message   TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_aac_sync_learner_vendor ON aac_sync_state (learner_id, vendor);
CREATE INDEX idx_aac_sync_learner ON aac_sync_state (learner_id);

CREATE TABLE family_settings (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  coughdrop_api_key_encrypted TEXT,
  coughdrop_user_id           VARCHAR(128),
  aac_vendor_preference       VARCHAR(32),
  updated_at                  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_family_settings_user ON family_settings (user_id);
