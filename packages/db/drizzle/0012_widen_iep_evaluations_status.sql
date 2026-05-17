-- 0009 created iep_evaluations.status as varchar(20), but the decision
-- handler in assessment-svc/src/routes/iep-evaluations.ts persists the
-- terminal state "eligibility_determined" (23 chars). The truncation made
-- the entire decision path silently unusable in environments that ran the
-- migration as written. Widen the column so the production code matches
-- the storage shape.
--
-- Idempotent: ALTER COLUMN TYPE is safe to re-run with the same target
-- type. We do not lower the previous default or drop the index that
-- references this column.

ALTER TABLE "iep_evaluations"
  ALTER COLUMN "status" TYPE varchar(40);
