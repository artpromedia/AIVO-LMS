-- Sprint 07: Profile recommendations v2 (additive, reversible).
-- Two tables: the recommendation record itself, and a before/after Brain
-- snapshot taken when an effect is applied. The legacy recommendations
-- table is untouched.

CREATE TABLE IF NOT EXISTS profile_recommendations_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL,
  tenant_id uuid,
  type varchar(80) NOT NULL,
  title text NOT NULL,
  parent_summary text NOT NULL,
  current_value jsonb,
  proposed_value jsonb,
  amended_value jsonb,
  confidence real NOT NULL,
  evidence_json jsonb DEFAULT '[]'::jsonb,
  requires_parent_approval boolean NOT NULL DEFAULT true,
  affects_iep boolean NOT NULL DEFAULT false,
  affects_instructional_access boolean NOT NULL DEFAULT false,
  reversible boolean NOT NULL DEFAULT true,
  status varchar(30) NOT NULL DEFAULT 'PENDING',
  decline_reason text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  applied_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_recommendations_v2_learner ON profile_recommendations_v2(learner_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_v2_status ON profile_recommendations_v2(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_v2_type ON profile_recommendations_v2(type);
CREATE INDEX IF NOT EXISTS idx_recommendations_v2_tenant ON profile_recommendations_v2(tenant_id);

CREATE TABLE IF NOT EXISTS profile_recommendation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  before_json jsonb DEFAULT '{}'::jsonb,
  after_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_snapshots_rec ON profile_recommendation_snapshots(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_snapshots_learner ON profile_recommendation_snapshots(learner_id);

-- Down migration (manual rollback):
-- DROP TABLE IF EXISTS profile_recommendation_snapshots;
-- DROP TABLE IF EXISTS profile_recommendations_v2;
