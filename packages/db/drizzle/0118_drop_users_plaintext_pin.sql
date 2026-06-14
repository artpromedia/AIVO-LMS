-- Drop the legacy plaintext learner PIN column. Learner PIN credentials now
-- live exclusively in learner_pin_credentials.pin_hash (Argon2id encoded).
ALTER TABLE users DROP COLUMN IF EXISTS pin;
