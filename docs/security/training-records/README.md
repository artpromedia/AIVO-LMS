# Security Training Records

Sprint 16. Owner: Security lead + People Ops.
Satisfies SOC 2 CC1.4 (Personnel Security) — referenced from
`docs/security/soc2-control-matrix.md`.

## What lives here

- `template.csv` — the canonical row schema. People Ops exports a
  populated copy quarterly into the offline HR system; engineering
  keeps the schema (and only the schema) in the repo so the SOC 2
  auditor can see the format any time.
- Populated training records themselves are NOT committed (PII).
  They live in the HR system (Lever / Rippling) with quarterly
  exports archived to the secure evidence vault.

## Required trainings

Every AIVO employee and long-term contractor with access to
production data MUST complete the following annually:

| Course                                 | Cadence          | Owner              | Evidence column          |
| -------------------------------------- | ---------------- | ------------------ | ------------------------ |
| Security awareness (phishing, social) | Annual           | Security lead      | `training_name=sec-aware-YYYY` |
| Privacy + FERPA / COPPA basics         | Annual           | Counsel + Security | `training_name=privacy-YYYY`    |
| Secure coding (engineers only)         | Annual           | Engineering Lead   | `training_name=sec-coding-YYYY` |
| Incident response refresher            | Annual           | Security on-call   | `training_name=ir-refresh-YYYY` |
| Data classification + handling         | Annual           | Counsel            | `training_name=data-class-YYYY` |
| Step-up auth + MFA enrolment           | Onboarding       | IT                 | `training_name=mfa-enroll`      |
| Tabletop drill participation           | Annual (rotating) | Security on-call   | `training_name=tabletop-YYYY`   |

Quarterly refresh of selected topics (e.g. new phishing patterns)
happens in Q3 per `docs/security/annual-review-calendar.md`.

## Row schema

See `template.csv`. Columns:

- `employee_id` — HR system identifier (NOT an SSO sub).
- `name` — full name as it appears in HR.
- `role` — job family (Eng / Ops / Support / Counsel / Exec).
- `training_name` — slug from the table above
  (e.g. `sec-aware-2026`).
- `completion_date` — ISO-8601 UTC date.
- `expires_at` — ISO-8601 UTC date (typically completion + 365d).
- `evidence_link` — URL to the LMS completion certificate or the
  signed acknowledgement in the HR system.

## Audit ask

When SOC 2 audit requests "show me training records for the
observation window", People Ops exports the HR system query with
`completion_date BETWEEN <start> AND <end>` and uploads the CSV to
the evidence vault. The repo schema (`template.csv`) is the
formal-definition cross-reference.

## Termination handling

When an employee leaves, their HR record is retained per the People
Ops retention policy. The training rows REMAIN — they are evidence
that the now-departed person was trained while they had access.
