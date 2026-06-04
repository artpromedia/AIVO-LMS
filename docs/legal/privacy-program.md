# AIVO Privacy Program (Sprint 05)

This document is the narrative description of AIVO's privacy program: the
regulatory scope we operate under, the rights data subjects hold and how
each maps to a request our platform can fulfill, our retention and
consent models, how we handle erasure and anonymization, the service
levels we commit to, and where the public files a request.

It is the legal-operations companion to the engineering controls in
`docs/adr/0034-data-governance.md` (architecture),
`docs/runbooks/dsar.md` (operations),
`docs/compliance/state-privacy-matrix.md` (statute-to-control mapping),
and `docs/compliance/consent-matrix.md` (consent catalog).

This is an operational reference, not legal advice. Coordinate any
substantive change to scope, rights handling, retention, or consent with
counsel, and update `docs/compliance/state-privacy-matrix.md` in the same
change.

## 1. Regulatory scope

AIVO is a K-12 education product. We design to the **strictest of the
overlapping regimes** that apply to a given data subject:

- **FERPA** (20 U.S.C. § 1232g; 34 C.F.R. Part 99) — we operate as a
  "school official" with a legitimate educational interest under each
  district's Data Processing Agreement, and we honour the parent right
  to inspect, request amendment of, and control disclosure of education
  records.
- **COPPA** (15 U.S.C. §§ 6501-6506; 16 C.F.R. Part 312) — for learners
  **under 13** we require **verifiable parental consent** before
  collecting personal information, and we give parents the right to
  review and delete their child's information.
- **GDPR Arts. 15-22** — for subjects in scope of EU/UK data-protection
  law we honour access, rectification, erasure, portability,
  restriction, and objection.
- **CCPA / CPRA** — for California consumers we honour the rights to
  know, delete, correct, and to limit use of sensitive personal
  information.
- **State student-privacy statutes** — SOPIPA, NY Education Law § 2-d,
  Illinois SOPPA, Colorado, Connecticut, and others, as mapped in
  `docs/compliance/state-privacy-matrix.md`.

Where two regimes set different limits — for example a retention window
or a fulfillment deadline — we apply the stricter one.

## 2. Data-subject rights and how each maps to a DSAR type

Every right below is exercised through a **Data Subject Access Request
(DSAR)** processed by `services/data-governance-svc`. A DSAR moves
through an explicit lifecycle — intake → assigned → approved/rejected →
fulfilled — and every step is recorded with evidence
(`docs/adr/0034-data-governance.md`, `docs/runbooks/dsar.md`).

| Right                     | Statutory basis                                    | DSAR request type | How we fulfill it                                                                                                  |
| ------------------------- | -------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| Access / right to know    | GDPR Art. 15; FERPA inspection; CCPA right to know | **access**        | Export fan-out: each owning service returns its records for the subject, reassembled into one bundle.              |
| Data portability          | GDPR Art. 20                                       | **portability**   | The same export, delivered as machine-readable, structured JSON with a manifest.                                   |
| Rectification / amendment | GDPR Art. 16; FERPA amendment; CPRA correction     | **rectification** | Routed to the owning service's correction surface; the change is audit-logged.                                     |
| Erasure / right to delete | GDPR Art. 17; COPPA parental deletion; CCPA delete | **erasure**       | Erasure fan-out: each owning service purges or anonymizes by subject id and confirms with a checksum.              |
| Restriction of processing | GDPR Art. 18                                       | **restriction**   | Processing for the subject is suspended pending resolution; recorded on the DSAR.                                  |
| Objection                 | GDPR Art. 21                                       | **objection**     | Processing based on the objected-to ground is stopped; consent-gated processing is revoked via the consent ledger. |

A DSAR is admissible from **anyone with a verified identity**, or from a
**parent acting on behalf of a learner under 13** (COPPA). Intake
verification — identity proofing, and confirming the parent-of-record
relationship plus active parental consent — is mandatory before approval
and is detailed in `docs/runbooks/dsar.md`.

## 3. Retention philosophy

We retain personal data **only as long as a lawful basis requires**, and
we set that window **per data class**, not globally. A chat transcript,
an IEP, a hashed audit record, and a billing invoice have materially
different lawful retention windows; a single platform-wide window would
be wrong for nearly all of them.

Retention is configured in `retention_policies` and governed by the
`data_catalog` (the authoritative list of data classes, their owning
service, sensitivity tier, and retention rule). Each policy specifies the
window, whether expiry results in **hard deletion or anonymization**, and
how it interacts with a **legal retention hold** — an active hold (a
district litigation hold, a regulatory preservation order) suspends
deletion until it lifts, per `docs/deletion-workflow.md`.

## 4. Consent model

Consent is recorded in an **append-only consent ledger** (`consents`):
grants and revocations are both appended; the effective state is the most
recent entry. This gives us a provable history of _when consent existed_,
which is exactly what COPPA verifiable-parental-consent and lawful-basis
audits require — we can show consent was in force at the moment a given
piece of data was collected.

For learners **under 13**, we require **verifiable parental consent**
before collecting personal information. The parent of record must hold an
active, non-revoked `child_data_collection` consent; a learner's own
action on her own data is still blocked when parental consent is missing
or revoked. The full consent catalog and the surfaces each consent type
gates are in `docs/compliance/consent-matrix.md`.

Marketing consent is **off by default** and never gates product
functionality. Revoking a consent that gated processing stops that
processing going forward.

## 5. Data-class catalog & sensitivity tiers

The `data_catalog` is the authoritative inventory of what we hold:

| Field          | Meaning                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| `class`        | The data class (e.g. learner profile, assessment responses, lesson history, IEP, audit record, billing identifier). |
| owning service | The single service that is the authority for that class.                                                            |
| sensitivity    | The sensitivity tier driving handling and access controls.                                                          |
| retention rule | The `retention_policies` rule that governs its lifecycle.                                                           |

The catalog is also the **subscriber manifest** for DSAR fan-out: a
service participates in export and erasure because it owns a data class
in the catalog. This keeps "what we hold" and "what a DSAR reaches" from
drifting apart — a data class with no implementing service is a defect,
not a silent gap (`docs/adr/0034-data-governance.md` §5).

Highest-sensitivity classes — IEP text, medical notes, free-form chat,
OCR text — are additionally redacted out of audit metadata and export
artifacts before persistence (`docs/audit-event-taxonomy.md`,
`docs/parent-export-format.md`); they are never carried in a log or a
bundle in raw form.

## 6. Erasure and anonymization

A right-to-erasure request fans out to every owning service, each of
which **purges or anonymizes** the subject's records and confirms with a
checksum of affected counts. The orchestrator marks the request fulfilled
only when every expected service confirms and the checksums reconcile —
so erasure is reconciled and evidenced, not assumed.

**Audit records are anonymized, not deleted.** The audit log is an
append-only, hash-chained, tamper-evident record
(`docs/audit-event-taxonomy.md`, `docs/runbooks/audit-restore.md`).
Hard-deleting a subject's audit rows would break the hash chain and
destroy the integrity guarantee the entire compliance and security
posture depends on. Instead, audit-svc **anonymizes the actor-identifying
fields in place while preserving the chain**: after erasure the log still
proves _that_ an action occurred and _when_, but no longer ties it to the
erased subject. We rely on a lawful basis for retaining a tamper-evident
security and compliance log, and we disclose this approach to subjects so
that "anonymized" is not mistaken for "incomplete erasure". Every other
class is purged unless a legal retention hold is active.

## 7. Service levels

SLAs are configurable per tenant but bounded by regime:

- **Acknowledgement: 72 hours** from intake.
- **Fulfillment: 30 days.** GDPR Art. 12 allows 30 days; CCPA allows 45.
  Where a GDPR basis applies we enforce the **stricter 30-day** window.

A DSAR approaching or past its fulfillment SLA raises a banner in the
compliance console and pages status-page-svc, so an impending breach is
operationally visible and not merely a reporting line. A missed window is
handled per `docs/runbooks/dsar.md`: documented cause, remediation
timeline, subject notification, and a postmortem.

## 8. Where to file a request

The public files a Data Subject Access Request at **`/privacy/request`**,
which submits to `POST /dsar` in `services/data-governance-svc`. The
request is open to any individual with a verified identity and to parents
acting on behalf of a learner under 13. The requester receives an
acknowledgement within 72 hours and a fulfillment within the applicable
window, together with — for access and portability requests — a
machine-readable, portable bundle of their data.

District and school administrators with the appropriate role may also
file and process DSARs on behalf of their own subjects through the
compliance console, subject to the role and step-up-MFA controls in
`docs/adr/0034-data-governance.md` §9.

## Cross-references

- `docs/adr/0034-data-governance.md` — DSAR, erasure orchestration &
  retention architecture.
- `docs/runbooks/dsar.md` — operational DSAR runbook.
- `docs/compliance/state-privacy-matrix.md` — statute-to-control mapping.
- `docs/compliance/consent-matrix.md` — consent type catalog.
- `docs/deletion-workflow.md` — deletion state machine & retention holds.
- `docs/audit-event-taxonomy.md` — audit event shape & redaction.
- `docs/parent-export-format.md` — export bundle contents & redaction.
- `docs/dpa-management.md` — DPA acceptance per district (FERPA basis).
