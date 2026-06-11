-- Sprint A8 — per-user timezone (IANA name) + how it was set.
-- tz_source: 'auto' (browser-detected, may be refreshed) | 'user'
-- (explicitly chosen in settings; never auto-overwritten).
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone varchar(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS tz_source varchar(8);
