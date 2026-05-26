# SOC 2 Control Matrix

Sprint 16 deliverable. This is the source of truth for SOC 2 Type II
control mapping. Each row maps a Trust Service Criterion (TSC) to:

1. The implementing code file(s) (Code).
2. The test file(s) that prove the control works (Test).
3. The evidence artifact location for the auditor (Evidence).

When a referenced file does not yet exist (sibling sprints in flight)
the row is annotated `TODO(sprint-XX)` with the expected path. The
`scripts/release-gate.mjs` `soc2:matrix-zero-todos` check enforces
zero `TODO(...)` markers once the comment marker

```
<!-- soc2-matrix: zero-todos -->
```

is added to this file. Until that marker lands, the gate soft-passes.

## Companion documents

- `docs/security/soc2-readiness.md` — engineer-facing readiness brief
- `docs/security/incident-response-runbook.md` — IR procedures (Sprint 16)
- `docs/security/breach-notification-runbook.md` — per-jurisdiction breach timing
- `docs/security/key-rotation.md` — KEK/JWK rotation policy (Sprint 16)
- `docs/security/annual-review-calendar.md` — annual review cadence
- `docs/adr/0021-soc2-readiness.md` — ADR pinning framework + auditor
- `docs/deploy/dr-runbook.md` — DR drill procedure + RTO/RPO

---

## CC1 — Control Environment

| Control                  | Code                                                                 | Test                                                                                 | Evidence                                                          |
| ------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| CC1.1 Integrity / ethics | `CODE_OF_CONDUCT.md`                                                 | n/a (policy doc)                                                                     | Signed acknowledgements in HR system (offline)                    |
| CC1.2 Board oversight    | `docs/security/annual-review-calendar.md`                            | n/a                                                                                  | Quarterly board minutes (offline)                                 |
| CC1.3 Org structure      | `docs/adr/0021-soc2-readiness.md`                                    | n/a                                                                                  | Org chart (offline)                                               |
| CC1.4 Personnel security | `docs/security/training-records/README.md`                           | n/a                                                                                  | `docs/security/training-records/template.csv` exported quarterly  |
| CC1.5 Accountability     | `services/audit-svc/`, `packages/security/src/audit-chain.ts`         | `packages/security/tests/*.test.ts`                                                  | Audit chain hash exports in `scripts/dr/results/*.json`           |

## CC2 — Communication & Information

| Control                       | Code                                                                                       | Test                                                                              | Evidence                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| CC2.1 Internal communication  | `docs/security/incident-response-runbook.md`                                                | n/a                                                                               | Slack `#sec-incidents` archive (offline)                                       |
| CC2.2 External communication  | `services/status-page-svc/`                                                                 | TODO(sprint-14): `services/status-page-svc/__tests__/external-comms.test.ts`      | Status page change history at status.aivo.dev (offline)                        |
| CC2.3 Communication of policy | `SECURITY.md`, `docs/security/soc2-readiness.md`                                            | n/a                                                                               | Repository git history                                                         |

## CC3 — Risk Assessment

| Control                | Code                                                          | Test                                                          | Evidence                                                              |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| CC3.1 Risk objectives  | `docs/security/threat-model.md`                               | n/a                                                           | Annual risk assessment report (offline, due Feb per calendar)         |
| CC3.2 Risk identification | `docs/security/threat-model.md`, `docs/security/pentest-*.md` | n/a                                                           | Pentest reports under `docs/security/pentest-*.md`                    |
| CC3.3 Fraud risk       | `services/audit-svc/`, `packages/security/src/audit-chain.ts` | `packages/security/tests/*.test.ts`                          | Audit chain integrity reports                                         |
| CC3.4 Change identification | `.github/workflows/ci.yml`, `.github/workflows/production-gates.yml` | Workflow runs on each PR                                  | GitHub Actions run history                                            |

## CC4 — Monitoring Activities

| Control                  | Code                                                                                           | Test                                                                       | Evidence                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| CC4.1 Ongoing monitoring | `packages/observability/`, `services/alerts-proxy-svc/`                                         | TODO(sprint-12-finish): `services/alerts-proxy-svc/__tests__/dispatch.test.ts` | Grafana dashboards (TODO(sprint-12-finish): `infra/grafana/dashboards/`) |
| CC4.2 Evaluation         | `scripts/release-gate.mjs`, `.github/workflows/production-gates.yml`                            | `pnpm release:gate` log                                                    | CI run history                                                            |

## CC5 — Control Activities

| Control                       | Code                                                              | Test                                                              | Evidence                                                              |
| ----------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| CC5.1 Control selection       | This document                                                     | n/a                                                               | This file in repo                                                     |
| CC5.2 Technology controls     | `.github/workflows/ci.yml`, `.github/workflows/secret-scan.yml`    | CI workflow runs                                                  | Workflow run history                                                  |
| CC5.3 Policy deployment       | `docs/security/`, ADRs under `docs/adr/`                          | n/a                                                               | Repository git history                                                |

## CC6 — Logical & Physical Access

| Control                          | Code                                                                                                  | Test                                                                              | Evidence                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| CC6.1 Logical access (RBAC)      | `services/identity-svc/src/routes/admin.ts`, `services/identity-svc/src/hooks/require-district-admin.ts` | `services/identity-svc/tests/district-route-coverage.test.ts`                    | `pnpm auth:audit` report                                                          |
| CC6.2 New / modified credentials | `services/identity-svc/src/routes/scim.ts`                                                            | `services/identity-svc/tests/scim-users.test.ts`                                  | SCIM provisioning logs                                                            |
| CC6.3 Access removal             | `services/identity-svc/src/routes/admin.ts` (user disable / SCIM deprovision)                          | `services/identity-svc/tests/scim-users.test.ts`                                  | SCIM deprovision logs                                                             |
| CC6.4 Physical access            | Hetzner data center physical security                                                                 | n/a                                                                               | Hetzner SOC 2 (vendor)                                                            |
| CC6.5 Asset disposal             | `docs/deletion-workflow.md`                                                                            | `services/data-governance-svc/src/__tests__/deletion-workflow.test.ts`            | Deletion request audit chain                                                      |
| CC6.6 External authentication    | `services/identity-svc/src/routes/sso.ts`                                                              | `services/identity-svc/tests/sso-discover.test.ts`                                | SSO success/failure logs                                                          |
| CC6.7 Encryption in transit      | `services/*/src/index.ts` (Fastify HTTPS), HSTS preload                                               | TODO(sprint-15): TLS scan workflow `.github/workflows/tls-scan.yml`               | TLS scan results (TODO)                                                           |
| CC6.8 Malware prevention         | `.github/workflows/secret-scan.yml`, Trivy in `.github/workflows/ci.yml`                              | CI runs                                                                           | Workflow run history                                                              |

## CC7 — System Operations

| Control                              | Code                                                                                       | Test                                                                                  | Evidence                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| CC7.1 Vulnerability management       | `.github/workflows/ci.yml` (Trivy, Bandit, pnpm audit), `.github/CVE_ALLOWLIST.yml`         | CI runs                                                                               | Workflow run history; CVE allowlist file                                              |
| CC7.2 Monitoring & anomaly detection | `packages/observability/src/health-check.ts`, `services/alerts-proxy-svc/`                  | TODO(sprint-12-finish): alerts-proxy dispatch test                                    | TODO(sprint-12-finish): Grafana alert rules in `infra/grafana/alerts/`                |
| CC7.3 Incident response              | `docs/security/incident-response-runbook.md`                                                | TODO: `e2e/incident-drill.spec.ts` (quarterly drill)                                  | Post-mortems under `docs/runbooks/post-mortems/` (TODO directory)                     |
| CC7.4 Recovery from incidents        | `docs/security/incident-response-runbook.md`, `docs/deploy/dr-runbook.md`                   | `scripts/dr/backup-restore-drill.sh --dry-run`                                        | `scripts/dr/results/*.json`                                                           |
| CC7.5 Identifying confidentiality    | `docs/security/threat-model.md`, `docs/security/breach-notification-runbook.md`             | n/a                                                                                   | Threat model in repo                                                                  |

## CC8 — Change Management

| Control                       | Code                                                                                            | Test                                                                              | Evidence                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| CC8.1 Change authorization    | `.github/workflows/ci.yml`, `.github/workflows/production-gates.yml`, branch protection         | Required PR reviews on every PR                                                   | GitHub branch protection settings (offline)                                       |
| CC8.2 Change testing          | `.github/workflows/ci.yml` build/test jobs                                                       | All `tests/*.test.ts` + Python `pytest`                                           | CI run history                                                                    |
| CC8.3 Change documentation    | `docs/adr/`, `docs/release/`                                                                    | n/a                                                                               | Repo git history                                                                  |
| CC8.4 Emergency changes       | `docs/security/incident-response-runbook.md` § Containment                                       | n/a                                                                               | Incident timeline log                                                             |

## CC9 — Risk Mitigation

| Control                       | Code                                                                                            | Test                                                                              | Evidence                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| CC9.1 Risk mitigation         | This document + `docs/security/threat-model.md`                                                  | n/a                                                                               | Annual risk-assessment doc (offline)                                                  |
| CC9.2 Vendor management       | `services/data-governance-svc/src/services/dpa-store.ts`                                        | `services/data-governance-svc/src/__tests__/dpa-store.test.ts`                    | DPA store contents + sub-processor list (`docs/dpa-management.md`)                    |

## A1 — Availability

| Control                       | Code                                                                                     | Test                                                                              | Evidence                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A1.1 Capacity planning        | `infra/` (k8s HPA configs), `services/ai-svc/` provider rate-limit absorption              | TODO(sprint-15): load-test workflow already exists at `.github/workflows/load-test.yml` | Load test results (CI artifacts)                                                  |
| A1.2 Backups                  | `scripts/dr/backup-restore-drill.sh`, `.github/workflows/backup-verify.yml`                | `scripts/dr/backup-restore-drill.sh --dry-run`                                    | `scripts/dr/results/*.json`                                                       |
| A1.3 Recovery                 | `scripts/dr/backup-restore-drill.sh`, `docs/deploy/dr-runbook.md`                          | DR drill (quarterly)                                                              | `scripts/dr/results/*.json`                                                       |

## C1 — Confidentiality

| Control                       | Code                                                                                          | Test                                                                              | Evidence                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| C1.1 Data classification      | `docs/security/threat-model.md` asset table                                                    | n/a                                                                               | Threat model in repo                                                              |
| C1.2 Disposal                 | `services/data-governance-svc/src/services/deletion-workflow.ts`                              | `services/data-governance-svc/src/__tests__/deletion-workflow.test.ts`            | Deletion request audit chain                                                      |
| C1.3 Encryption at rest       | `packages/security/src/envelope.ts` (Sprint 16), DB volume encryption (provider)               | `packages/security/tests/envelope.test.ts` (Sprint 16)                            | KEK rotation log per `docs/security/key-rotation.md`                              |

## PI1 — Processing Integrity

| Control                       | Code                                                                                          | Test                                                                              | Evidence                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| PI1.1 Input validation        | Zod at every BFF; Fastify schemas at every service route                                      | `apps/web-v2/tests/integration/bff/*.spec.ts`                                     | BFF integration test artifacts                                                    |
| PI1.2 Processing accuracy     | `packages/ai-validation/` (lesson plan, tutor response)                                       | `packages/ai-validation/tests/*.test.ts`                                          | CI test history                                                                   |
| PI1.3 Output correctness      | `services/ai-svc/` provider fallback + safety net                                              | `services/ai-svc/tests/test_*.py`                                                 | CI test history                                                                   |
| PI1.4 Idempotency             | `services/billing-svc/src/routes/webhooks.ts` (Stripe), roster import batch id                | `services/billing-svc/tests/webhooks.test.ts`                                     | Webhook event ledger                                                              |
| PI1.5 Audit logging coverage  | `scripts/ci/audit-coverage-check.mjs` (Sprint 16)                                              | CI `audit-coverage` job                                                           | `scripts/ci/results/audit-coverage-latest.json`                                   |

## P1 — Privacy

| Control                       | Code                                                                                          | Test                                                                              | Evidence                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| P1.1 Notice                   | Marketing site privacy policy + COPPA + FERPA pages                                            | n/a                                                                               | Marketing site history (offline)                                                  |
| P1.2 Consent                  | `packages/security/src/flags.ts` consent helpers; `pnpm consent:audit`                         | TODO: consent gate test under `packages/security/tests/consent.test.ts`           | `pnpm consent:audit` log                                                          |
| P1.3 Collection limitation    | `services/data-governance-svc/`                                                                | `services/data-governance-svc/src/__tests__/export-builder.test.ts`               | DSAR export samples                                                               |
| P1.4 Use limitation           | Tenant scope + consent gates                                                                   | `services/identity-svc/tests/district-route-coverage.test.ts`                     | `pnpm auth:audit` log                                                             |
| P1.5 Retention                | `services/data-governance-svc/src/services/retention-policy.ts`                                | TODO(sprint-13): `services/data-governance-svc/src/__tests__/retention.test.ts`   | Retention policy enforcement log                                                  |
| P1.6 Disclosure to 3rd party  | `services/data-governance-svc/src/services/dpa-store.ts`                                       | `services/data-governance-svc/src/__tests__/dpa-store.test.ts`                    | Disclosure ledger at `/admin/platform/compliance/disclosures`                     |
| P1.7 Access (DSAR)            | `services/data-governance-svc/src/routes/exports.ts`                                            | `services/data-governance-svc/src/__tests__/export-builder.test.ts`               | Export job records                                                                |
| P1.8 Quality / amendment      | Parent confirm/correct UI on IEP extraction                                                    | `services/assessment-svc/tests/test_*.py`                                          | Audit chain for IEP amendments                                                    |

---

## Sprint 16 cross-cutting controls

| Topic                         | Code / Doc                                                                                     | Test                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Access control                | `services/identity-svc/src/middleware/step-up.ts` + `routes/step-up.ts`                         | `services/identity-svc/tests/step-up-sprint16.test.ts`                            |
| Change management gates       | `.github/workflows/ci.yml` + `.github/workflows/production-gates.yml` + `scripts/release-gate.mjs` | CI run history                                                                    |
| Encryption envelope           | `packages/security/src/envelope.ts`                                                             | `packages/security/tests/envelope.test.ts`                                        |
| Monitoring                    | `packages/observability/src/health-check.ts` (PR #55), Grafana dashboards (PR #54)              | Health-check probe history                                                        |
| Incident response             | `docs/security/incident-response-runbook.md`                                                    | Tabletop drill quarterly                                                          |
| Vendor management             | `services/data-governance-svc/src/services/dpa-store.ts` (PR #57)                               | `services/data-governance-svc/src/__tests__/dpa-store.test.ts`                    |
| Data classification           | `docs/security/threat-model.md`                                                                 | n/a                                                                               |
| Backup / restore              | `scripts/dr/backup-restore-drill.sh`, `.github/workflows/quarterly-dr-drill.yml`                | DR drill quarterly                                                                |
| Secure development            | `.github/workflows/ci.yml` lint + typecheck + tests                                             | CI                                                                                |
| Key rotation                  | `docs/security/key-rotation.md`, OIDC JWK rotation in identity-svc (PR #55)                     | TODO: `packages/security/tests/key-rotation.test.ts`                              |
| Audit logging                 | `scripts/ci/audit-coverage-check.mjs`, `packages/security/src/audit-chain.ts`                   | CI `audit-coverage` job                                                           |
| Secrets management            | `packages/security/src/secrets-client.ts` (PR #55)                                              | Hardened boot validation in `services/identity-svc/src/index.ts`                  |

---

## Open TODOs (tracked for follow-up sprints)

Listed inline above using `TODO(sprint-XX)` markers. Summary of expected
paths that do not yet exist at this commit:

- `services/status-page-svc/__tests__/external-comms.test.ts`
- `services/alerts-proxy-svc/__tests__/dispatch.test.ts`
- `infra/grafana/dashboards/` and `infra/grafana/alerts/`
- `.github/workflows/tls-scan.yml`
- `e2e/incident-drill.spec.ts`
- `docs/runbooks/post-mortems/`
- `packages/security/tests/consent.test.ts`
- `services/data-governance-svc/src/__tests__/retention.test.ts`
- `packages/security/tests/key-rotation.test.ts`

When all TODOs are closed, append the marker below on its own line and
the `scripts/release-gate.mjs` `soc2:matrix-zero-todos` check will flip
to blocking:

```
<!-- soc2-matrix: zero-todos -->
```
