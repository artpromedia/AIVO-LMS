# Breach Notification Runbook

Sprint 16. Owner: Legal counsel + Security lead.
Operational sibling of `docs/security/incident-response-runbook.md`.

> Legal-counsel-required gate: NO external notification — to regulators,
> customers, parents, learners, or press — may go out without explicit
> sign-off from the General Counsel (or counsel's designate). The IC's
> Communications Lead drafts; counsel approves.

## 1. Trigger

Initiate this runbook when any of the following becomes likely:

- Confirmed or strongly-suspected unauthorized access to personal
  information (PI), student PII, FERPA records, or teacher records.
- Confirmed or strongly-suspected loss of integrity of audit chain.
- Sub-processor reports a breach affecting AIVO-routed data.
- Regulatory or law-enforcement contact regarding our data.

Severity SEV0 or SEV1 in the IR runbook ALWAYS triggers this runbook.

## 2. Per-jurisdiction timing matrix

The clock starts at **confirmation** — the point at which Security and
Counsel agree a reportable event occurred. Confirmation MUST happen
within 72h of detection; if more time is needed, log the reason in the
timeline ledger.

| Jurisdiction / Law                              | Subjects                                       | Notice timer                          | Recipient                                                                       | Source ref                          |
| ----------------------------------------------- | ---------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------- |
| **NY SHIELD Act** (N.Y. Gen. Bus. Law § 899-aa) | NY residents, including teacher/student PII    | **Most expedient time, ≤ 60 days; 2-business-day notice to school district when teacher/student PII** | Affected individual + NY AG + state police + consumer reporting agencies if > 5,000 | NY Gen. Bus. Law § 899-aa(2)(a)     |
| **CA SOPIPA + AB 1584**                         | CA K-12 learners (operator covered)            | Without unreasonable delay            | LEA / district contact (per contract)                                           | CA Bus. & Prof. § 22584             |
| **CA CCPA / CPRA**                              | CA consumers                                   | Without unreasonable delay (~ 45 days typical) | Affected individual + CA AG if > 500 residents                                  | CA Civ. Code § 1798.82              |
| **Colorado SB 18-006**                          | CO residents                                   | ≤ 30 days                             | Affected individual + CO AG if > 500 residents                                  | C.R.S. § 6-1-716                    |
| **Connecticut Public Act 22-15**                | CT residents incl. student records             | ≤ 60 days                             | Affected individual + CT AG                                                     | CT Gen. Stat. § 36a-701b            |
| **COPPA-specific (FTC)**                        | Children < 13                                  | Without unreasonable delay; FTC guidance recommends ≤ 30 days | FTC + affected parents                                                          | 16 CFR Part 312                     |
| **FERPA**                                       | Students (educational records)                 | No federal timer; LEA's policy governs; AIVO contractually notifies district within 24h | LEA / district contact                                                          | 20 USC § 1232g; 34 CFR Part 99      |
| **GDPR Art. 33 / 34**                           | EU data subjects                               | **72 hours to supervisory authority**; "without undue delay" to data subjects when high risk | Lead SA + affected data subjects                                                | GDPR Art. 33(1), 34(1)              |
| **HIPAA** (if PHI involved — not standard)      | Patients                                       | ≤ 60 days                             | HHS + affected individual + media if > 500 in a state                            | 45 CFR § 164.404, 164.406, 164.408  |

> The matrix above is engineering's quick-reference. Final timing
> determination is counsel's. State law continues to evolve — re-check
> at each annual policy review (Jan; see annual calendar).

## 3. Workflow

1. **Confirm reportable event** (Security + Counsel).
2. **Identify affected jurisdictions** — query the user/learner data
   to identify resident states / countries. Use
   `services/data-governance-svc/` to export the affected cohort.
3. **Start the per-jurisdiction clock** — log start time per row in the
   incident timeline ledger.
4. **Draft notice** for each audience using the templates below.
5. **Counsel review** — mandatory before any send.
6. **Send** via the matching channel (status page, email, mailed letter
   when statute requires).
7. **Log** — record send time, recipients (counts and where required by
   law, individual delivery confirmation), and content version in the
   incident ledger.

## 4. Templates

> Templates are the engineering starting point. Counsel finalises wording.

### 4.1 School / district administrator

```
Subject: [URGENT] Security incident affecting <district> data on AIVO

Dear <admin name>,

On <date>, AIVO identified a security incident that may have affected
data associated with your district's learners and staff. We are
contacting you within our contractual notification window.

What happened: <one paragraph in plain language>
What information was involved: <enumerated categories>
What we are doing: <containment + remediation summary>
What you can do: <recommended steps>

A full technical brief is available on request. Our security contact
for this incident is <name, email, phone>.

— AIVO Security
```

### 4.2 Parent / guardian

```
Subject: Notice of a security incident involving your child's information

Dear <parent name>,

We are writing to let you know about a recent security incident that
may have involved information about your child, <learner first name>.

What happened: <plain language paragraph>
What information was involved: <categories, in lay terms>
What we have done: <containment in lay terms>
What you should do: <if relevant: rotate password, monitor>
Free resources we are offering: <e.g. credit monitoring if PII>

If you have questions, please contact us at security@aivo.dev or
<phone>. You may also contact your school's administrator or the
district at <district contact>.

— AIVO
```

### 4.3 Learner (teen / older)

```
Subject: Important: a security issue with your AIVO account

Hi <first name>,

We had a security issue at AIVO and your account information may have
been involved. We are letting you and your parent/guardian know at the
same time.

Here's what happened: <plain language>
Here's what we did: <plain language>
Here's what you should do: <change password, etc.>

Questions: security@aivo.dev. We're sorry this happened.

— AIVO
```

### 4.4 Regulator (statutory notice)

```
[Use counsel-supplied template per jurisdiction]
Required fields typically:
- Reporting entity name, address, contact
- Date(s) of incident and discovery
- Type of personal information involved
- Number of state residents affected
- Description of containment + remediation
- Sample of consumer notice
- Credit-monitoring offer (where applicable)
```

### 4.5 Press / public statement

```
[Comms team / counsel only. Engineering does not draft press.]
```

### 4.6 Sub-processor breach passthrough (we are the controller)

When a vendor (sub-processor) notifies us of a breach affecting our
customers' data:

```
Subject: Notice of sub-processor security incident

Dear <admin name>,

We were notified on <date> by our sub-processor <vendor name> of a
security incident on their systems. AIVO's processing of your data
through this vendor was for <purpose>. Their notification indicates:

- Date of incident: <date>
- Data categories involved: <list>
- Their containment status: <summary>
- Affected AIVO customers: <count or list>

AIVO's response:
- We have <paused / rotated / migrated> the integration.
- Our DPA with <vendor> requires <X>; we are tracking their
  remediation against that obligation.
- Updated sub-processor entry in our DPA store
  (`services/data-governance-svc/src/services/dpa-store.ts`).

— AIVO Security
```

## 5. After-action

Notifications and recipient counts feed into the post-mortem under
`docs/runbooks/post-mortems/INC-<id>.md` § Impact. The annual security
training (Q3 per `annual-review-calendar.md`) reviews any breach
notifications sent in the prior year.

## 6. Legal-counsel-required gate

Hard rule: **no external notification (regulator, customer, parent,
learner, press) goes out without written counsel sign-off** in the
incident ledger. The Communications Lead pastes counsel's approval
(Slack DM screenshot or email forward) into the ledger before sending.
The on-call IC verifies this before authorising the send.
