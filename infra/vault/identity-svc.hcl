# Sprint 12.7 — Vault bootstrap for identity-svc.

path "secret/data/identity/auth-secret" {
  capabilities = ["read"]
}

path "secret/data/identity/cookie-secret" {
  capabilities = ["read"]
}

path "secret/data/identity/jwt-private-key" {
  capabilities = ["read"]
}

path "secret/data/identity/jwt-public-key" {
  capabilities = ["read"]
}

path "secret/data/identity/internal-service-token" {
  capabilities = ["read"]
}

path "secret/data/identity/internal-ai-token" {
  capabilities = ["read"]
}

path "secret/data/identity/+" {
  capabilities = ["read"]
}
