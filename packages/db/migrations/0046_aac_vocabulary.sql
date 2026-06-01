-- Sprint 3 (production readiness) — per-learner AAC vocabulary.
--
-- The symbol board synced to external AAC vendors (CoughDrop, Proloquo2Go, …)
-- is built from these rows instead of an empty placeholder. Every board is
-- anchored by curated `core` words (high-frequency, topic-independent) with
-- `fringe` words layered on top. `symbol_key` is the stable id within the
-- configured symbol set; the image URL is resolved at board-build time.

DO $$ BEGIN
  CREATE TYPE aac_word_kind AS ENUM ('core', 'fringe');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS aac_vocabulary (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id        uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  locale            varchar(16) NOT NULL DEFAULT 'en',
  label             varchar(128) NOT NULL,
  symbol_key        varchar(128) NOT NULL,
  kind              aac_word_kind NOT NULL DEFAULT 'fringe',
  grid_row          integer NOT NULL,
  grid_col          integer NOT NULL,
  background_color  varchar(16),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aac_vocab_learner_locale_symbol
  ON aac_vocabulary (learner_id, locale, symbol_key);
CREATE INDEX IF NOT EXISTS idx_aac_vocab_learner_locale
  ON aac_vocabulary (learner_id, locale);
