-- Wave C (G5) — per-tenant recommendation-approval delegation.
-- Districts may delegate profile-recommendation approval to teachers
-- (instructional types) and caregivers (regulation/sensory types).
-- Parents remain always-authoritative and IEP-affecting recommendations
-- never delegate (enforced in @aivo/enterprise-core
-- canApproveProfileRecommendation). B2C tenants have no
-- district_settings row, so they stay parent-only by construction.
ALTER TABLE district_settings
  ADD COLUMN IF NOT EXISTS approval_policy JSONB
  DEFAULT '{"teacherApproval": false, "caregiverApproval": false}'::jsonb;
