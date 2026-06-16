-- Cross-platform learner unification (Task #34).
-- At most one web learner profile may link a given canonical identity-svc
-- learner UUID per tenant, so concurrent BFF reconciles can never materialize
-- duplicate web learners for the same identity learner. Partial: only rows that
-- actually carry an identityLearnerId are constrained.
CREATE UNIQUE INDEX IF NOT EXISTS "web_learner_profiles_identity_link_uq"
  ON "web_learner_profiles" ("tenant_id", (("data") ->> 'identityLearnerId'))
  WHERE (("data") ->> 'identityLearnerId') IS NOT NULL;
