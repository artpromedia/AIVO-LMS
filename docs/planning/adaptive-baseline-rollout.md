# Adaptive Baseline — Rollout & Parity Gate (G10)

How we take the adaptive baseline from flagged-off to default-on without
regressing learners. Reversible at every step.

## Flags

| Flag | Gates | Default |
|------|-------|---------|
| `AIVO_FEATURE_BASELINE_ADAPTIVE` | local adaptive selection + the wider BANK pool + telemetry capture | OFF in prod, ON in dev/preview |
| `AIVO_FEATURE_BASELINE_STREAMING` | drive the assessment-svc session run-loop instead of the local pool | OFF (explicit opt-in) |
| `CRON_SECRET` | authorizes the scheduled recalibration job (`GET /api/bff/admin/baseline-recalibration/run`) | unset |

The fixed-form BANK path is always retained as the fallback: any failure
in the adaptive/streaming path degrades to it, so the flags are true kill
switches.

## Stages

1. **Off (baseline).** Fixed-form selection. Production default today.
2. **Shadow.** Turn `BASELINE_ADAPTIVE` on in a preview / canary tenant.
   Telemetry accrues; the recalibration job + admin psychometrics view
   (`/admin/platform/baseline-items`) populate. No learner-visible risk —
   selection is adaptive but bounded by the same question pool, and
   accommodations are preserved (G7 parity tests).
3. **Pilot cohort.** Enable for a small set of tenants. Score the cohort
   with the **parity gate** (below). Watch completion rate, median items,
   and placement agreement.
4. **Default-on.** Flip the prod default once the gate passes on the pilot
   and the recalibration view shows no red flags (mass `recommendRetire`).
5. **Streaming (separate track).** Only after default-on and once the
   `@aivo/security` signing keys are shared across web-v2 ↔ assessment-svc
   (so the minted learner JWT verifies), enable `BASELINE_STREAMING` on a
   canary. Same fallback discipline applies.

## Parity gate

Implemented in `lib/learner/baseline-parity.ts`
(`evaluateParityGate(runs, thresholds)`), pure over completed runs so a
shadow/monitoring job can score a cohort.

Metrics per run:
- **Completion** — did the run finish.
- **Placement agreement** — the adaptive θ-derived band lands within one
  band of the simple accuracy-derived band (they shouldn't disagree wildly
  on where to start a learner).

Default thresholds (`DEFAULT_PARITY_THRESHOLDS`):
- `minCompletionRate: 0.90`
- `minAgreementRate: 0.80`

An empty cohort never passes (`no_runs`). The result lists blocking reasons
(e.g. `completion_rate 0.5 < 0.9`) so it's actionable.

## Rollback

Flip the relevant flag OFF. In-flight runs revert to fixed-form on the next
render; persisted telemetry is harmless to retain. No data migration is
required to roll back.

## Related

- `docs/planning/adaptive-baseline-rebuild-blueprint.md` — the original plan.
- `lib/learner/baseline-adaptive.ts` — selection + kindness ceiling (G5).
- `lib/learner/baseline-telemetry.ts` + `lib/jobs/recalibrate-baseline.ts`
  — telemetry + recalibration job (G2/G9).
- `lib/learner/baseline-session.ts` — streaming orchestrator (fallback-safe).
