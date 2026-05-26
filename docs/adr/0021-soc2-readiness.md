# 0021 — SOC 2 Type II readiness framework

- **Status:** Accepted
- **Date:** 2026-05-26
- **Deciders:** Security lead, Engineering Lead, General Counsel
- **Related:** Sprint 16; `docs/security/soc2-control-matrix.md`;
  `docs/security/soc2-readiness.md`;
  `docs/security/incident-response-runbook.md`;
  `docs/security/breach-notification-runbook.md`;
  `docs/security/key-rotation.md`;
  `docs/security/annual-review-calendar.md`;
  `scripts/release-gate.mjs`;
  `scripts/ci/audit-coverage-check.mjs`;
  `scripts/dr/backup-restore-drill.sh`

## Context

AIVO has decided to pursue a SOC 2 Type II attestation covering the
five Trust Service Criteria (Security, Availability, Confidentiality,
Processing Integrity, Privacy). The Type II report attests not just
to control design but to control effectiveness over an observation
window, so we need:

- A single source of truth that maps each TSC to the implementing
  code, the proving tests, and the evidence artifact location.
- Operational runbooks that produce that evidence as a side effect of
  normal engineering work (DR drills, IR post-mortems, training
  exports, key rotations).
- A pre-release gate that refuses to ship when SOC 2 prerequisites
  are missing.
- Clarity on the auditor and the observation window so engineering
  knows what window of evidence has to be airtight.

Sprints 13/14/15 produce evidence that this readiness work cites
(audit emissions, crisis runbook, accessibility evidence). Sprints
12.6 and 12.7 produced the secrets management abstraction and the
blocking security-scan CI that this work builds on.

## Decision

1. **Framework:** SOC 2 **Type II**. We do NOT pursue Type I; Type I
   only attests design, and an attestation that doesn't cover
   operational effectiveness undersells what AIVO has already built
   (audit chain, IR runbook, DR drill cadence).

2. **Auditor:** TBD. The Security lead + General Counsel will select a
   vendor in the next planning cycle. Candidates considered include
   the standard SOC 2 boutiques; the engineering bar for the selected
   auditor is willingness to ingest evidence via API rather than
   email-driven evidence collection.

3. **Observation window:** Start date TBD — placeholder
   `<observation_window_start>`. The window MUST be at least 6
   months. Engineering target: open the window the first day of the
   month following auditor selection.

4. **Source of truth:** `docs/security/soc2-control-matrix.md`
   is canonical. Every TSC row cites a real file path; gaps are
   marked `TODO(sprint-XX)`. When the marker
   `<!-- soc2-matrix: zero-todos -->` lands in that file, the
   release-gate `soc2:matrix-zero-todos` check flips from soft-pass
   to blocking.

5. **Operational evidence pipeline:**
   - Audit emit on every mutating route, enforced by
     `scripts/ci/audit-coverage-check.mjs` (CI gate `audit-coverage`).
   - DR drill reports under `scripts/dr/results/` refreshed at least
     quarterly.
   - IR post-mortems under `docs/runbooks/post-mortems/`.
   - Training records exported quarterly from HR to the evidence vault.
   - Key rotation evidence per `docs/security/key-rotation.md`.

6. **Pre-release gate:** `scripts/release-gate.mjs` (Sprint 16) runs
   four SOC 2 soft gates on top of the existing per-domain audits:
   audit-coverage; soc2:matrix-zero-todos; dr:drill-within-90d;
   security:reviews-signed; feature-flags:100pct-staging-72h.

## Consequences

**Positive:**

- Engineers ship with the SOC 2 prerequisites built into the existing
  CI pipeline rather than as a separate compliance checklist.
- Evidence collection is a side effect of normal work; no
  end-of-window evidence-scramble.
- The control matrix gives the auditor a single grep target and gives
  engineers a single doc to keep current.

**Negative:**

- The release-gate adds latency to every production release. Mitigated
  by running the heavy sub-gates (audit-coverage, DR drill) in CI in
  parallel rather than serially at release time.
- The audit-coverage scanner ships in `--warn` mode initially — 257 of
  268 mutating routes are missing audit emits as of the Sprint 16
  baseline (see `scripts/ci/results/audit-coverage-initial.json`).
  Each follow-up sprint is expected to close a slice of these gaps
  before the `--warn` flag is dropped.

**Open:**

- Auditor selection — gated on counsel review.
- Observation window start — gated on auditor selection.
- Cross-region key replication — currently single-region. Revisit
  once we have a second region under contract.

## Compliance

This ADR is itself an artifact for SOC 2 CC1.3 (Org structure) and
CC2.3 (Communication of policy). Updates to this ADR follow the
standard ADR amendment process (open a follow-up ADR rather than
editing in place).
