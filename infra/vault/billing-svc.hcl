# Sprint 12.7 — Vault bootstrap for billing-svc.
#
# This file documents the Vault path layout and policy for the billing
# service. It is NOT applied automatically by CI; an operator runs
# `vault policy write billing-svc infra/vault/billing-svc.hcl` and
# `vault kv put secret/billing/stripe value=<key>` during initial
# cluster provisioning.
#
# Path convention: secret/<service>/<logical-name>
# Each entry stores a single `value` field — services read this via
# packages/security/src/secrets-client.ts.

path "secret/data/billing/stripe-secret-key" {
  capabilities = ["read"]
}

path "secret/data/billing/stripe-webhook-secret" {
  capabilities = ["read"]
}

path "secret/data/billing/stripe-publishable-key" {
  capabilities = ["read"]
}

# Read-only on every billing-specific secret. Rotation runs through an
# operator policy that holds `update` on the same paths.
path "secret/data/billing/+" {
  capabilities = ["read"]
}
