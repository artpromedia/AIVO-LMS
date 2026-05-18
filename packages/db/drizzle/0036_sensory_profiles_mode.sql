-- Adds the global UI sensory mode column to sensory_profiles.
-- Backs the "Inclusive Lab — Warm" rollout's per-learner mode
-- persistence (mobile + web sync this through assessment-svc's
-- POST /api/assessments/sensory-profile endpoint).
--
-- Values: "standard" | "calm" | "high-contrast". Distinct from the
-- per-channel sensitivity columns (visual/auditory/etc.) — those
-- describe the learner, this describes their preferred UI tone.

ALTER TABLE sensory_profiles
  ADD COLUMN IF NOT EXISTS mode VARCHAR(20) DEFAULT 'standard';
