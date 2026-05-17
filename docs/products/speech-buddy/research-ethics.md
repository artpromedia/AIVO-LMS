# Speech Buddy — research ethics (stub)

> **Status: STUB.** This file is a placeholder owned by the Speech Buddy
> skill-graph + research telemetry task. The foundations task (this PR) only
> creates the file so downstream code and docs can link to a stable path.
>
> The skill-graph task is responsible for filling in the sections below to
> IRB-style standard before any opt-in telemetry is collected.

## Sections to author downstream

- **Purpose of data collection** — what cohort outcomes the research pipeline
  is intended to measure, and what it explicitly is **not** intended to do
  (e.g. no individual-level inferences exposed back to families).
- **Consent & opt-in flow** — how families opt into research telemetry
  separately from product consent; default OFF; revocable at any time with
  one click; revocation purges historical contributions.
- **De-identification** — pseudonymisation scheme, k-anonymity threshold for
  any released aggregate, prohibition on rejoining with PII.
- **Data minimisation** — what is collected (skill-mastery deltas, session
  counts, age-banded Likert self-reports) and what is **never** collected
  (raw transcripts, voice features, real names).
- **Storage, retention, and deletion** — encryption, retention windows per
  data class, automated deletion on consent revocation or pilot expiry.
- **Access & roles** — who can view the weekly aggregated report, audit
  logging on every read, prohibition on individual-level export.
- **External release** — gating process (review by child-safety lead +
  research lead) before any aggregate leaves the platform.
- **Incident response** — what counts as a research-data incident, who is
  notified, in what timeframe.

## Cross-references

- Product spec: `docs/products/speech-buddy/README.md`
- Safety policy: `docs/products/speech-buddy/safety.md`
- Threat model: `docs/products/speech-buddy/threat-model.md`
