-- Sprint 09: Data governance + enterprise audit tables (additive).

CREATE TABLE IF NOT EXISTS dpa_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id uuid NOT NULL,
  version varchar(60) NOT NULL,
  accepted_by_id uuid NOT NULL,
  accepted_by_name text NOT NULL,
  accepted_by_role varchar(40) NOT NULL,
  accepted_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dpa_acceptances_district ON dpa_acceptances(district_id);
CREATE INDEX IF NOT EXISTS idx_dpa_acceptances_version ON dpa_acceptances(version);

CREATE TABLE IF NOT EXISTS deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL,
  requester_id uuid NOT NULL,
  requester_role varchar(40) NOT NULL,
  status varchar(40) NOT NULL DEFAULT 'PENDING_REVIEW',
  export_before_delete jsonb DEFAULT 'true'::jsonb,
  retention_hold_json jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_learner ON deletion_requests(learner_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON deletion_requests(status);

CREATE TABLE IF NOT EXISTS data_export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL,
  requested_by_id uuid NOT NULL,
  requested_by_role varchar(40) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'queued',
  formats jsonb DEFAULT '[]'::jsonb,
  storage_refs jsonb DEFAULT '[]'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  completed_at timestamp
);
CREATE INDEX IF NOT EXISTS idx_data_export_jobs_learner ON data_export_jobs(learner_id);
CREATE INDEX IF NOT EXISTS idx_data_export_jobs_status ON data_export_jobs(status);

CREATE TABLE IF NOT EXISTS enterprise_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  actor_id uuid,
  actor_role varchar(40) NOT NULL,
  action varchar(100) NOT NULL,
  resource_type varchar(100) NOT NULL,
  resource_id varchar(255),
  learner_id uuid,
  before_hash varchar(64),
  after_hash varchar(64),
  reason text,
  ip_hash varchar(64),
  user_agent_hash varchar(64),
  metadata_json jsonb DEFAULT '{}'::jsonb,
  occurred_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enterprise_audit_tenant ON enterprise_audit_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_audit_learner ON enterprise_audit_events(learner_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_audit_action ON enterprise_audit_events(action);
CREATE INDEX IF NOT EXISTS idx_enterprise_audit_occurred ON enterprise_audit_events(occurred_at);

-- Down migration (manual rollback):
-- DROP TABLE IF EXISTS enterprise_audit_events;
-- DROP TABLE IF EXISTS data_export_jobs;
-- DROP TABLE IF EXISTS deletion_requests;
-- DROP TABLE IF EXISTS dpa_acceptances;
