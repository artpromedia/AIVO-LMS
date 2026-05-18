# State and federal student-privacy matrix (Sprint 04)

This document maps the statutes AIVO_LMS must satisfy to the controls
that satisfy them. Engineering changes to consent, data retention, DSAR,
deletion, sub-processor lists, or roster import must reference this
matrix and update the affected row in the same PR.

This is an engineering reference, not legal advice. Coordinate any
substantive change with counsel before publishing.

## Federal

### COPPA — Children's Online Privacy Protection Act (15 U.S.C. §§ 6501–6506; 16 C.F.R. Part 312)

| Requirement                                                                                    | AIVO control                                                                                                              | Owner                        |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Verifiable parental consent (VPC) before collecting personal information from a child under 13 | `child_data_collection` consent type; age-gate (`AgeGateRecord.requiresParentConsent`); `requireLearnerConsent` BFF guard | identity-svc, web-v2         |
| Right to review and delete child's information                                                 | Parent DSAR flow (`data_export_request`), deletion flow (`data_deletion_request`) via data-governance-svc                 | data-governance-svc          |
| Posted privacy notice                                                                          | Marketing `/privacy-policy`, `/coppa-compliance`                                                                          | apps/marketing               |
| Limit retention to what's necessary; allow deletion                                            | Retention policy in `services/data-governance-svc`; deletion workflow per `docs/deletion-workflow.md`                     | data-governance-svc          |
| School-authorized VPC for ed-tech use                                                          | District/school admin path with parent opt-in/out gate (Sprint 12)                                                        | integrations-svc, family-svc |

### FERPA — Family Educational Rights and Privacy Act (20 U.S.C. § 1232g; 34 C.F.R. Part 99)

| Requirement                                                         | AIVO control                                                                                                       | Owner                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| "School official" exception for ed-tech vendors with direct control | DPA template per `docs/dpa-management.md`; tenant scope enforced in every BFF                                      | enterprise-core, audit-svc |
| Parent right to inspect education records                           | Parent DSAR export bundle includes IEP, assessments, lesson history                                                | data-governance-svc        |
| Parent right to request amendment                                   | Parent profile correction surfaces; IEP extraction "confirm/correct" UI (Sprint 06)                                | family-svc, assessment-svc |
| Disclosure tracking                                                 | Admin disclosure ledger (`apps/web-v2/app/admin/platform/compliance/disclosures`) with `ferpaBasis` per disclosure | admin-svc                  |
| Limit access on a need-to-know basis                                | Role guard + tenant scope + learner ownership; teacher cannot see other classes                                    | identity-svc, web-v2       |

## State

### SOPIPA — Student Online Personal Information Protection Act (California, B&P Code §§ 22584 et seq.)

| Requirement                                                | AIVO control                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| No targeted advertising based on student data              | Marketing analytics catalog excludes learner PII (Sprint 10)   |
| No selling of student information                          | DPA prohibits resale; no sub-processor passes raw learner data |
| Reasonable security; deletion on request                   | Encryption-at-rest, KMS-managed keys, deletion workflow        |
| Disclosure only for K–12 purposes or with parental consent | Consent matrix above; teacher_access consent type              |

### New York Education Law § 2-d (Parents' Bill of Rights for Data Privacy and Security)

| Requirement                                                | AIVO control                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| Bill of Rights signed by every educational agency contract | DPA template includes NY 2-d addendum (Sprint 12 polish)    |
| Encryption of PII at rest and in transit                   | TLS 1.2+ in transit; AES-256 at rest via cloud provider KMS |
| Annual data security training                              | Tracked in `docs/security/access-control.md` (Sprint 16)    |
| Data breach notification                                   | Incident response runbook (Sprint 16)                       |

### Illinois SOPPA — Student Online Personal Protection Act (105 ILCS 85)

| Requirement                                                           | AIVO control                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------- |
| Public list of operators with whom the school has a written agreement | District admin can publish operator list via admin-svc  |
| Posted privacy policy linking to data-collection statement            | Marketing privacy page links to AIVO sub-processor list |
| Breach notification within 30 days                                    | Incident workflow (Sprint 16)                           |

### Colorado Student Data Privacy and Security Act (C.R.S. § 22-16-101 et seq.)

| Requirement                                         | AIVO control                            |
| --------------------------------------------------- | --------------------------------------- |
| Data Privacy Agreement (DPA) with each LEA          | DPA template includes Colorado addendum |
| Public posting of student PII categories collected  | Marketing privacy page lists categories |
| Annual training; breach notification within 30 days | Sprint 16 deliverables                  |

### Connecticut Student Data Privacy (Conn. Gen. Stat. § 10-234aa et seq.)

| Requirement                                                    | AIVO control                                         |
| -------------------------------------------------------------- | ---------------------------------------------------- |
| Written contract for every district                            | DPA includes Connecticut addendum                    |
| Detail of data categories, security measures, breach reporting | Sub-processor list + security architecture doc       |
| Parental right to delete student-created content               | Deletion workflow includes learner-created artifacts |

## Industry pledges

### Student Privacy Pledge 2020

AIVO commits to the Pledge: not selling student PII, not behaviorally
targeting students, transparent data practices, encryption,
parent/student access and deletion, and annual training. Marketing
copy must not claim compliance until the Pledge signature is published
and the docs above are public. Sprint 10 owns the marketing copy
gating.

## Open items routed to later sprints

- Sprint 06: parent confirm/correct UI for IEP extraction
- Sprint 12: per-school DPA template + addendum injection
- Sprint 13: marketing_opt_in honored across email/SMS/push channels
- Sprint 16: security training records; breach notification runbook;
  annual policy review schedule

## Cross-references

- `docs/compliance/consent-matrix.md` — consent type catalog
- `docs/data-governance-center.md` — retention + DSAR + deletion architecture
- `docs/deletion-workflow.md` — operational steps
- `docs/dpa-management.md` — DPA template + per-LEA addenda
- `docs/audit-event-taxonomy.md` — auditable events
- `docs/security-architecture.md` — encryption, key management, segmentation
