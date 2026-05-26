-- Sprint 14 (B) — per-tenant LLM budgets
--
-- Tracks daily/monthly LLM spend caps with auto-downgrade when crossed.
-- ai-svc reads/writes this table via packages/db/src/schema/tenant_budgets.ts.
--
-- One row per (tenant_id, period). When the running spend (current_cents)
-- crosses cap_cents:
--   1. ai-svc auto-downgrades the tenant's cost band to 'economy' for the
--      remainder of the period and stamps `auto_downgraded_at`.
--   2. emits metric `tenant_llm_cap_exceeded_total{tenant_id}`.
--   3. emails the tenant admin via comms-svc.
--
-- When the downgraded-band model still cannot serve the request within
-- the remaining budget, ai-svc refuses with HTTP 429 and a retry-after
-- equal to (period_end - now).

CREATE TABLE IF NOT EXISTS tenant_llm_budgets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  period              TEXT NOT NULL CHECK (period IN ('daily','monthly')),
  cap_cents           BIGINT NOT NULL CHECK (cap_cents >= 0),
  current_cents       BIGINT NOT NULL DEFAULT 0 CHECK (current_cents >= 0),
  period_start        TIMESTAMPTZ NOT NULL,
  period_end          TIMESTAMPTZ NOT NULL,
  auto_downgraded_at  TIMESTAMPTZ NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active row per (tenant, period) — the (period_start, period_end)
-- window itself is uniquely identified by the bucket start so the index
-- below is sufficient for upsert semantics.
CREATE UNIQUE INDEX IF NOT EXISTS tenant_llm_budgets_tenant_period_start_uq
  ON tenant_llm_budgets (tenant_id, period, period_start);

-- Lookup index for the active-row read path: ai-svc fetches the row whose
-- window contains "now" for each (tenant, period).
CREATE INDEX IF NOT EXISTS tenant_llm_budgets_tenant_period_active_idx
  ON tenant_llm_budgets (tenant_id, period, period_end);

-- Audit index: ops dashboard lists recently auto-downgraded tenants.
CREATE INDEX IF NOT EXISTS tenant_llm_budgets_downgraded_at_idx
  ON tenant_llm_budgets (auto_downgraded_at)
  WHERE auto_downgraded_at IS NOT NULL;

COMMENT ON TABLE tenant_llm_budgets IS
  'Sprint 14: per-tenant LLM spend caps + auto-downgrade ledger. ai-svc owns reads/writes.';
COMMENT ON COLUMN tenant_llm_budgets.cap_cents IS
  'Hard spend cap for the period, in cents.';
COMMENT ON COLUMN tenant_llm_budgets.current_cents IS
  'Running spend during the period, in cents. Reset to 0 at period_start.';
COMMENT ON COLUMN tenant_llm_budgets.auto_downgraded_at IS
  'When ai-svc auto-downgraded this tenant to economy band. NULL when not downgraded.';
