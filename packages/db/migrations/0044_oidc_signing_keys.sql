-- Sprint 12.7 — OIDC provider signing key set.
--
-- One row per key. `active = true` rows are used for new signatures;
-- inactive rows remain published via /oidc/jwks.json for a short
-- grace window so existing tokens can still be verified. The OIDC
-- rotate endpoint sets `active=false` and `rotated_at=now()` on the
-- currently-active row, then inserts a fresh one.

CREATE TABLE IF NOT EXISTS oidc_signing_keys (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kid         text NOT NULL UNIQUE,
  jwk         jsonb NOT NULL,
  public_jwk  jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  rotated_at  timestamptz,
  active      boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS oidc_signing_keys_active_idx
  ON oidc_signing_keys (active, created_at DESC);
