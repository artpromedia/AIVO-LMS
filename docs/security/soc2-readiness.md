# SOC 2 readiness (Sprint 16)

Control posture mapped to the five Trust Services Criteria. This is
an engineering reference; coordinate audit scope with the
compliance / counsel function before the formal engagement.

## Security (Common Criteria)

| Control | Where it lives |
|---|---|
| Access control — RBAC | identity-svc roles + `requirePageRole` + `requireLearnerScope` |
| Access control — MFA | TOTP + WebAuthn + recovery codes (`packages/security::mfa-crypto`); `MFA_FORCED_ROLES` for admins |
| Access control — SSO | identity-svc Google / Apple / Clever / ClassLink; SCIM in `routes/scim.ts` |
| Boundary protection | Hetzner k8s + service mesh; per-service DB users |
| Encryption at rest | DB volume encryption (provider); TOTP secret AES-GCM (KMS); IEP object storage SSE |
| Encryption in transit | TLS 1.2+; HSTS preload; internal mesh TLS |
| Logging + monitoring | `@aivo/observability`; `audit-svc` append-only chain; ops-alerts → alerts-proxy-svc |
| Change management | PR review required; production gates (this sprint) block merges that regress contracts |
| Vulnerability management | `pnpm audit` + `security-scan.yml` + Dependabot; pentest in `docs/security/pentest-*.md` |
| Endpoint security | engineers use FDE laptops + WebAuthn; admin panel WebAuthn-only |

## Availability

| Control | Where it lives |
|---|---|
| Backups | `backup-verify.yml` workflow; restore drill documented in `docs/runbooks/audit-restore.md` |
| RPO / RTO | RPO ≤ 24 h (daily backup), RTO ≤ 4 h (warm standby) |
| Health checks | every service exposes `/health`; `health-check.yml` workflow |
| Capacity | k8s HPA; provider abstraction for AI to absorb upstream rate limits |
| Incident response | `docs/security/incident-response.md` |

## Processing integrity

| Control | Where it lives |
|---|---|
| Data validation | Zod at every BFF boundary; Fastify schemas at every service route |
| Lesson plan validation | `GeneratedLessonPlanSchema.parse()` even on the safety-net fallback (Sprint 07) |
| Webhook idempotency | `stripe_webhook_events` table + per-handler idempotency (Sprint 11) |
| Roster import idempotency | upsert by extId; batch rollback by `batchId` (Sprint 12) |
| AI output policy | `validateLessonPlan` + `validateTutorResponse` + `blockedFallbackFor` (Sprint 14) |

## Confidentiality

| Control | Where it lives |
|---|---|
| Data classification | `docs/security/threat-model.md` asset table |
| Consent perimeter | `requireLearnerConsent` on every sensitive BFF; `consent:audit` (Sprint 04) |
| Teacher-safe IEP | derived `teacher_safe_iep_summary` only; raw IEP never exposed to teacher; `comms:audit` forbids in templates (Sprint 13) |
| AI provider isolation | `AI_PROVIDER=mock` refused in prod; PII redaction before any provider call |
| Cache key hygiene | TTS cache keys are content-hashed, not learner-tagged (Sprint 15) |

## Privacy

| Control | Where it lives |
|---|---|
| Notice | marketing privacy policy + COPPA + FERPA pages |
| Choice / consent | `CONSENT_TYPES` enum (10 types); `consent:audit` enforces (Sprint 04) |
| Collection limitation | only collect what `child_data_collection` consent covers |
| Use limitation | tenant scope; consent-type-specific gates |
| Access | parent DSAR export via `data-governance-svc` |
| Disclosure | admin disclosure ledger at `/admin/platform/compliance/disclosures` with `ferpaBasis` per disclosure |
| Quality / amendment | parent confirm/correct UI on IEP extraction (Sprint 06) + brain profile review (Sprint 06) |
| Monitoring + enforcement | audit chain (append-only); incident response (Sprint 16) |

## Audit trail

The append-only `audit_chain` (`packages/security/src/audit-chain.ts`)
hashes each event with the prior event's hash so tampering is
detectable. Restore drills replay the chain on a staging snapshot and
compare to the live chain hash.

## Open items routed to follow-ups

- Formal SOC 2 Type II engagement scoping
- Subprocessor list publication on marketing
- Annual security training records storage
- Customer-facing audit evidence vault (Drata / equivalent)
