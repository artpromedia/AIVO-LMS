# Governance & Compliance — Consolidated Status

**Last reviewed:** 2026-06-03 · **Owner:** Privacy / Platform on-call

A single entry point for the platform's data-governance and compliance
posture. It links the authoritative documents (which remain the source of
truth) and tracks **live implementation status** per control and per
DSAR-participating service, so a reviewer does not have to reconstruct the
picture from a dozen scattered files.

> This is an index + status board, **not** a replacement for the
> framework-specific docs. Where this file and a linked doc disagree, the
> linked doc wins — open a PR to fix this one.

---

## 1. Framework coverage

| Framework                                              | Status         | Source of truth                                                                                                                              |
| ------------------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| COPPA (verifiable parental consent, child data)        | 🟢 Implemented | [`docs/legal/privacy-program.md`](../legal/privacy-program.md), `identity-svc` consent records                                               |
| FERPA (school official, directory data, parent access) | 🟢 Implemented | [`docs/legal/privacy-program.md`](../legal/privacy-program.md), [`docs/data-governance-center.md`](../data-governance-center.md)             |
| GDPR / UK-GDPR (DSAR access, erasure, portability)     | 🟢 Implemented | [`docs/runbooks/dsar.md`](../runbooks/dsar.md), [`docs/adr/0034-data-governance.md`](../adr/0034-data-governance.md)                         |
| US state privacy (CCPA/CPRA et al.)                    | 🟢 Implemented | [`docs/compliance/state-privacy-matrix.md`](./state-privacy-matrix.md)                                                                       |
| Consent management                                     | 🟢 Implemented | [`docs/compliance/consent-matrix.md`](./consent-matrix.md)                                                                                   |
| SOC 2 (evidence automation, access review)             | 🟡 In progress | [`docs/security/soc2-readiness.md`](../security/soc2-readiness.md), `admin-svc` nightly evidence bundles                                     |
| Audit immutability (hash chain, tamper evidence)       | 🟢 Implemented | [`docs/adr/0032-audit-architecture.md`](../adr/0032-audit-architecture.md), [`docs/runbooks/audit-restore.md`](../runbooks/audit-restore.md) |
| DPA lifecycle (district agreements)                    | 🟢 Implemented | [`docs/dpa-management.md`](../dpa-management.md)                                                                                             |

Legend: 🟢 Implemented · 🟡 In progress · 🔴 Not started.

---

## 2. DSAR fan-out — live per-service status

The DSAR orchestrator (`data-governance-svc`) runs the request lifecycle and
fans `erase` / `export` out to each data-owning service's internal
`POST /__governance/{erase,export}` subscriber, reconciling per-service
checksums (see [ADR 0034](../adr/0034-data-governance.md) and the
[DSAR runbook](../runbooks/dsar.md)).

| Service           | Erase                 | Export | Notes                                                                                                |
| ----------------- | --------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `identity-svc`    | 🟢 delete             | 🟢     | User row + sessions, MFA, WebAuthn, password history/resets, admin sessions, consent records.        |
| `learning-svc`    | 🟢 delete             | 🟢     | Lesson runs/sessions, learning paths, gradebook, tutor sessions, generated plans, parent summaries.  |
| `integration-svc` | 🟢 delete             | 🟢     | Family settings, AAC sync state + vocabulary.                                                        |
| `billing-svc`     | 🟢 delete             | 🟢     | Subscriptions + tutor subscriptions (delete); tenant-scoped invoices (export).                       |
| `tenant-svc`      | 🟢 delete             | 🟢     | In-memory SIS roster: student record + class enrollments, subject-scoped by external id.             |
| `audit-svc`       | 🟢 anonymize          | 🟢     | Hash-chained — actor/network PII nulled in place; hashes untouched (forward chain stays verifiable). |
| `admin-svc`       | 🟢 delete + anonymize | 🟢     | `data_requests` deleted; hash-chained `admin_audit_log` actor PII anonymized in place.               |

**Anonymize vs delete:** append-only, hash-chained tables (`audit_events`,
`admin_audit_log`) are **never** hard-deleted — actor identity / network
columns are nulled (or, for NOT NULL columns, set to a redaction sentinel)
without touching `prev_hash` / `hash`, so the forward chain remains
verifiable. Backward content re-verification of an anonymized row showing a
null/redacted actor is the **expected, documented** DSAR outcome, not chain
corruption.

---

## 3. Durable persistence (state survives restart)

DSAR and admin-governance correctness depends on durable storage; in-memory
stores would lose subject data on restart and break reconciliation.

| Area                                  | Status      | Backing                                                            |
| ------------------------------------- | ----------- | ------------------------------------------------------------------ |
| DPA acceptances                       | 🟢 Postgres | `dpa_acceptances` (`data-governance-svc` dpa-store)                |
| DSAR requests / events / retention    | 🟢 Postgres | `data-governance-svc` schema (migration `0059`)                    |
| Admin classrooms / notification prefs | 🟢 Postgres | `admin_classrooms`, `admin_notification_prefs` (migration `0060`)  |
| Learner import jobs + rows            | 🟢 Postgres | `learner_import_jobs`, `learner_import_records` (migration `0060`) |
| Admin / audit logs                    | 🟢 Postgres | `admin_audit_log`, `audit_events`, `audit_events_v2`               |

All admin-svc stores follow the dpa-store precedent: an in-memory
implementation for tests / local dev and a Postgres implementation for
production, with `select*Store()` **refusing the in-memory store in
production** so state is never silently lost.

---

## 4. How to verify

```bash
# DSAR subscriber contract (in-process integration test)
pnpm --filter @aivo/data-governance-svc test

# Audit hash chain + anonymization behavior
pnpm --filter @aivo/audit-svc test

# Durable admin data layer (stores + routes, no DB required)
node --test --import tsx services/admin-svc/tests/school-admin-stores.test.ts

# Operate a real DSAR end-to-end
open docs/runbooks/dsar.md
```

---

## 5. Known gaps / follow-ups

- **SOC 2** evidence automation is live (nightly bundles) but the formal
  Type II window is in progress — see [`soc2-readiness.md`](../security/soc2-readiness.md).
- **Live-status dashboard:** this doc is the static consolidation. A
  machine-rendered dashboard (subscriber reachability + last reconciliation
  per service) is tracked in the enterprise-readiness roadmap.
- Reports in `admin-svc` that lack a source-of-record table are explicitly
  tagged `estimated` in their API responses until backing tables land.
