# Sprint 12.7 — Vault bootstrap for comms-svc.

path "secret/data/comms/postmark-webhook-secret" {
  capabilities = ["read"]
}

path "secret/data/comms/mailgun-webhook-signing-key" {
  capabilities = ["read"]
}

path "secret/data/comms/aivo-sns-webhook-secret" {
  capabilities = ["read"]
}

path "secret/data/comms/fcm-service-account-json" {
  capabilities = ["read"]
}

path "secret/data/comms/apns-private-key" {
  capabilities = ["read"]
}

path "secret/data/comms/+" {
  capabilities = ["read"]
}
