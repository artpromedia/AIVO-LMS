-- Sprint 16 — DR drill validation queries.
--
-- Executed by scripts/dr/backup-restore-drill.sh against the
-- restored PITR target. Each query is preceded by a comment that
-- describes the check + the threshold the drill script enforces.
-- The drill script parses one row per query; queries MUST return
-- a single row with a single numeric column when validating a count.

-- 1. Row count: users table is present and non-trivially populated.
-- Threshold: >= 1 (drill data sample seeds at least one user).
SELECT COUNT(*) AS users_count FROM users;

-- 2. Row count: tenants table.
SELECT COUNT(*) AS tenants_count FROM tenants;

-- 3. Row count: learners table.
SELECT COUNT(*) AS learners_count FROM learners;

-- 4. Audit chain continuity: count audit_events.
SELECT COUNT(*) AS audit_events_count FROM audit_events;

-- 5. Audit chain continuity: count audit events with a non-null
-- previous-event hash (every event after the genesis event should
-- have one). Compared against (audit_events_count - 1) in the
-- driver.
SELECT COUNT(*) AS audit_events_with_prev_hash
FROM audit_events
WHERE before_hash IS NOT NULL;

-- 6. Foreign-key integrity: orphan check — learners pointing at
-- a non-existent tenant.
SELECT COUNT(*) AS orphan_learners
FROM learners l
LEFT JOIN tenants t ON t.id = l.tenant_id
WHERE l.tenant_id IS NOT NULL AND t.id IS NULL;

-- 7. Foreign-key integrity: orphan check — sessions pointing at
-- a non-existent user.
SELECT COUNT(*) AS orphan_sessions
FROM sessions s
LEFT JOIN users u ON u.id = s.user_id
WHERE s.user_id IS NOT NULL AND u.id IS NULL;

-- 8. Most recent audit event timestamp — used by the driver to
-- compute the observed RPO (seconds between restore-snapshot
-- time and last audit event).
SELECT EXTRACT(EPOCH FROM (NOW() - MAX(occurred_at)))::BIGINT AS audit_lag_seconds
FROM audit_events;

-- 9. iep_documents row count present.
SELECT COUNT(*) AS iep_documents_count FROM iep_documents;

-- 10. consent rows present.
SELECT COUNT(*) AS consents_count FROM consents;
