-- Sprint B5 — drop the actor FK on the admin audit ledger.
--
-- Actors are not always users: SCIM provisioning writes the acting
-- TOKEN's id, service principals have no users row at all. With the FK
-- in place every such audit insert failed, and because audit emission is
-- best-effort (never breaks the user action) the failures were silently
-- swallowed — zero SCIM_* rows ever landed. An append-only audit ledger
-- must be self-contained: it records what happened even when the actor
-- row no longer (or never did) exist.
ALTER TABLE admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_actor_id_users_id_fk;
ALTER TABLE admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_actor_id_fkey;
