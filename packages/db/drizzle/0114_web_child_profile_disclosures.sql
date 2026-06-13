-- Sprint C-12 (ADR 0042) — FERPA child-profile disclosure log, web-v2 side.
--
-- Records a cross-role read of a child's brain profile on a web-v2 surface (the
-- web counterpart of the services' `CHILD_PROFILE_DISCLOSED` audit event). The
-- same disclosure tuple (tenantId, learnerId, readerUserId, readerRole, surface,
-- dataClass, timestamp). Append-only; queried per-learner + time-bounded by the
-- compliance surface.
--
-- RLS: NOT applied — sibling of web_disclosure_logs / web_iep_doc_access_logs
-- (append-only audit trails read by PLATFORM/ADMIN compliance flows; same
-- exclusion 0050 makes for web_users / web_audit_logs). Tenant scoping is in app
-- code via the indexed tenant_id column. Conventions match web-privacy.ts: TEXT
-- ids, full tuple in `data` JSONB, predicate columns only for the WHERE filters
-- (tenant_id, learner_id, disclosed_at — the per-learner time-window query).

CREATE TABLE IF NOT EXISTS "web_child_profile_disclosures" (
  "id" TEXT PRIMARY KEY,
  "learner_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "disclosed_at" TEXT NOT NULL,
  "data" JSONB NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_child_profile_disclosures_idx" ON "web_child_profile_disclosures" ("tenant_id", "learner_id", "disclosed_at");
