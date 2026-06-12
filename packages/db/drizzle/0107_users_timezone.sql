-- Persist the viewer's IANA timezone and whether it was auto-detected or
-- explicitly selected. The columns already exist in the Drizzle users schema.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezone" varchar(64);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tz_source" varchar(8);
