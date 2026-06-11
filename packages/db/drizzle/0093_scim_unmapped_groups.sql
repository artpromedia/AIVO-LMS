-- Sprint B5 — record IdP group pushes that did not match the class-group
-- naming convention (or referenced an unknown school), so they are
-- surfaced for review on the district SIS page instead of silently
-- dropped. (tenant_id, display_name) is unique: repeat pushes bump
-- last_seen_at/seen_count rather than piling up rows.
CREATE TABLE IF NOT EXISTS scim_unmapped_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  display_name varchar(512) NOT NULL,
  external_id varchar(255),
  reason varchar(64) NOT NULL,
  member_count integer NOT NULL DEFAULT 0,
  first_seen_at timestamp NOT NULL DEFAULT now(),
  last_seen_at timestamp NOT NULL DEFAULT now(),
  seen_count integer NOT NULL DEFAULT 1,
  resolved_at timestamp,
  resolved_by uuid REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_scim_unmapped_groups_tenant
  ON scim_unmapped_groups(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scim_unmapped_groups_unique
  ON scim_unmapped_groups(tenant_id, display_name);
