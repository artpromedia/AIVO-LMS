-- Sprint 12.7 — LTI 1.3 runtime tables.
--
-- One row per platform AIVO is registered against, plus the deployments
-- and per-launch context / resource-link rows. AGS line items are
-- tracked so we can write scores back.

CREATE TABLE IF NOT EXISTS lti_platforms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  issuer          text NOT NULL,
  client_id       text NOT NULL,
  jwks_url        text NOT NULL,
  auth_token_url  text NOT NULL,
  auth_login_url  text NOT NULL,
  label           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issuer, client_id)
);

CREATE TABLE IF NOT EXISTS lti_deployments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id     uuid NOT NULL REFERENCES lti_platforms(id) ON DELETE CASCADE,
  deployment_id   text NOT NULL,
  label           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform_id, deployment_id)
);

CREATE TABLE IF NOT EXISTS lti_contexts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id   uuid NOT NULL REFERENCES lti_deployments(id) ON DELETE CASCADE,
  lti_context_id  text NOT NULL,
  label           text,
  title           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deployment_id, lti_context_id)
);

CREATE TABLE IF NOT EXISTS lti_resource_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id      uuid NOT NULL REFERENCES lti_contexts(id) ON DELETE CASCADE,
  resource_link_id text NOT NULL,
  title           text,
  target_link_uri text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (context_id, resource_link_id)
);

CREATE TABLE IF NOT EXISTS lti_ags_lineitems (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_link_id uuid NOT NULL REFERENCES lti_resource_links(id) ON DELETE CASCADE,
  lineitem_url    text NOT NULL,
  label           text,
  score_maximum   double precision NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lti_contexts_by_deployment ON lti_contexts (deployment_id);
CREATE INDEX IF NOT EXISTS lti_resource_links_by_context ON lti_resource_links (context_id);
CREATE INDEX IF NOT EXISTS lti_ags_by_resource ON lti_ags_lineitems (resource_link_id);
