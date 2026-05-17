-- Sprint task #10: in-app + email alerts when an evaluation transitions
-- between statuses. The submit and decision endpoints now dispatch
-- notifications, and we need an idempotency latch so a retried submit
-- (e.g. mobile network flakiness) cannot fire duplicate emails to the
-- family or to district admins.
--
-- Two timestamp columns, both nullable. The notification dispatch is gated
-- on UPDATE … WHERE submit_notified_at IS NULL (and the decision
-- equivalent), so the database itself elects the single winner under
-- concurrent calls. Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE "iep_evaluations"
  ADD COLUMN IF NOT EXISTS "submit_notified_at" timestamp,
  ADD COLUMN IF NOT EXISTS "decision_notified_at" timestamp;
