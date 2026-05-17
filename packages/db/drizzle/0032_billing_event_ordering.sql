-- Sprint 5: out-of-order webhook protection.
--
-- Stripe can deliver subscription events out of order under retries:
-- e.g., `customer.subscription.updated` carrying past_due may arrive
-- *after* the next `invoice.paid` already cleared the row back to
-- active. Without sequencing, the second-arriving older event would
-- silently regress the row.
--
-- We record `last_stripe_event_at` from `event.created` on every
-- accepted update and have webhook handlers compare incoming events
-- against it. Older-than-stored events are acknowledged but skipped.

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "last_stripe_event_at" timestamp;

-- Same protection on invoices: an older `invoice.payment_failed` event
-- shouldn't be allowed to clobber a newer `invoice.paid` row.
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "last_stripe_event_at" timestamp;
