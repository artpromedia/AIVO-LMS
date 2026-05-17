-- Sprint 2 follow-up: surface the customer's default payment method and
-- record when we last notified the parent that their trial is ending.
--
-- 1. payment_method.attached webhooks land in the `default_payment_method_*`
--    columns so the billing UI can show "Visa ending 4242" without a
--    round trip to Stripe.
-- 2. customer.subscription.trial_will_end webhooks bump
--    `trial_will_end_notified_at`; comms-svc uses it to dedup the
--    renewal-reminder email.

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "default_payment_method_id" varchar(255),
  ADD COLUMN IF NOT EXISTS "default_payment_method_last4" varchar(8),
  ADD COLUMN IF NOT EXISTS "default_payment_method_brand" varchar(32),
  ADD COLUMN IF NOT EXISTS "trial_will_end_notified_at" timestamp;
