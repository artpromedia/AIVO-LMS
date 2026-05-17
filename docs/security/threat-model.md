# Threat model (Sprint 16)

Operational threat model for AIVO_LMS. This is paired with
`docs/security-architecture.md` (what's true today) and
`docs/security/soc2-readiness.md` (control posture). Update this
document whenever the system topology, data classifications, or
attack surface changes.

## Trust boundaries

```
public internet
    │
    ▼
[ marketing site ]   [ apps/web ]   [ apps/web-v2 ]   [ apps/mobile (Expo) ]
    │                    │                │                     │
    └────────────────────┴────────────────┴─────────────────────┘
                                 │
                                 ▼
                          [ next BFF (web-v2) ]
                                 │
                                 ▼
                       [ service mesh (Hetzner k8s) ]
   identity-svc / family-svc / brain-svc / learning-svc / tutor-svc /
   assessment-svc / homework-svc / ai-svc / billing-svc / comms-svc /
   integrations-svc / admin-svc / audit-svc / data-governance-svc /
   responsible-ai-svc / problem-session-svc / curriculum-svc /
   recommendation-svc / research-svc / status-page-svc / tenant-svc
                                 │
                                 ▼
                        [ Postgres + Redis ]
                                 │
                                 ▼
              [ object storage (IEP uploads, audio assets) ]
```

Boundaries enforced:

1. Browser → BFF: TLS 1.2+, HSTS, secure cookies, CSP, COOP/COEP, CSRF
   double-submit.
2. BFF → service mesh: internal-service token + JWT propagation.
3. Service → DB: per-service DB user, least-privilege roles.
4. Service → object storage: signed URL with TTL ≤ 5 min for IEP /
   audio assets; learner identity NOT in storage key (Sprint 15 TTS
   contract).

## Assets + classifications

| Asset | Classification | Where it lives | Controls |
|---|---|---|---|
| Learner profile (name, age, grade) | sensitive (child PII) | family-svc DB | consent-gated; FERPA "education record"; encrypted at rest |
| IEP document (raw) | restricted (child PII + medical-adjacent) | object storage; metadata in assessment-svc | upload requires iep_document_storage consent; never exposed to teacher or learner (raw); signed URL TTL ≤ 5 min |
| IEP-derived accommodations | sensitive | assessment-svc DB | accessible to teacher only via teacher_safe_iep_summary view |
| Mastery / progress | sensitive | learning-svc DB | tenant- + learner-scoped |
| Chat transcript (homework / tutor) | sensitive | homework-svc + ai-svc + audit | classifier-sanitized; safety:audit forbids leakage in comms templates |
| Auth credentials | restricted | identity-svc DB | bcrypt; refresh tokens hashed; TOTP secret AES-GCM with KMS |
| Stripe customer / subscription | sensitive | billing-svc DB | webhooks dedup'd; idempotency keys on mutating calls |
| Audit log | sensitive (forensic) | audit-svc DB | append-only chain (packages/security::audit-chain) |
| Parent DSAR export bundle | restricted | object storage | signed URL TTL ≤ 24 h; one-shot consent |

## Threat actors + scenarios

### External

| Threat | Mitigation |
|---|---|
| Brute-force / credential stuffing on login | rate-limit, MFA, WebAuthn, password-policy package, audit `auth.login.failure` |
| Phishing for parent credentials | WebAuthn primary path, email-verified password reset, no-cognitive-only auth (WCAG 3.3.8) |
| Prompt injection in homework / chat | `sanitizeHomeworkInput`, `prompt-injection-detector`, escalation policy (Sprint 14) |
| Web scraper extracting learner data | bot detection at CDN, rate-limited public endpoints, no learner data on marketing site |
| Stolen JWT replay | short-lived access tokens, refresh-token rotation, sessions table tracks `last_seen_at` |
| Cross-tenant data leak via crafted ID | every BFF route calls `requireLearnerScope` + tenant scope; `consent:audit` covers learner BFF |
| Mock-auth abuse in prod | env validator refuses `AUTH_MODE=mock` in prod; `auth:audit` enforces three guards |
| AI fallback abuse (mock plan in prod) | Sprint 07 contract — fallback plan re-validated with `.parse()`; Sprint 14 alert on fallback rate > 2% / 1h |

### Internal (operator)

| Threat | Mitigation |
|---|---|
| Operator queries raw IEP outside investigation | `iep.access` audit event per read; `docs/runbooks/admin-break-glass.md` policy |
| Operator deletes audit row | audit chain (packages/security::audit-chain) detects tampering |
| Operator impersonates parent | `admin.impersonate.start` event, role-mismatch redirect (Sprint 03), banner on every page |
| Secrets in repo | `gitleaks` + `.gitleaks.toml`, `secret-scan.yml` CI, secret-rotation runbook |

### Supply chain

| Threat | Mitigation |
|---|---|
| Compromised npm dep | pnpm overrides for known vulns (root package.json), `pnpm audit` in CI, SBOM generated per release |
| Compromised model provider | provider abstraction with circuit breaker + deterministic fallback; safety pipeline applies regardless of provider |
| Compromised Stripe webhook | signature verification, `stripe_webhook_events` idempotency table (Sprint 11) |

## Cross-references

- `docs/security-architecture.md` — what's true today
- `docs/security/soc2-readiness.md` — control posture per TSC
- `docs/security/incident-response.md` — IR runbook
- `docs/runbooks/*` — operational playbooks
- `docs/audit-event-taxonomy.md` — event catalog
- `docs/compliance/consent-matrix.md`, `state-privacy-matrix.md`
