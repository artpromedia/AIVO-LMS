# Crisis-escalation runbook (Sprint 14)

This runbook is the source of truth for what happens when the
responsible-ai-svc crisis detector raises a positive signal
(self-harm, suicidal ideation, abuse disclosure, or violence toward
others) on learner input or model output.

Authoritative pipeline:
`services/responsible-ai-svc/src/detectors/crisis.ts`
→ `escalateCrisis(...)` (PagerDuty + comms-svc + audit-svc fan-out).

---

## 1. Paging policy

| Field | Value |
| --- | --- |
| PagerDuty service | `AI_SAFETY_PRIMARY` (env `PAGERDUTY_AI_SAFETY_SERVICE_ID`) |
| Routing key | `PAGERDUTY_INTEGRATION_KEY` |
| Severity | `critical` |
| Dedup key | `aivo-crisis:<correlation_id>` (one page per learner turn) |
| Source | `responsible-ai-svc` |
| Class | crisis category — `self_harm` / `suicidal_ideation` / `abuse_disclosure` / `violence_to_others` |
| SLO | first page within **60 seconds** of detection (p95) |

Escalation policy on the PagerDuty service:

1. **0–5 min** — on-call AI safety primary (24/7).
2. **5–15 min** — AI safety secondary + the platform on-call.
3. **15+ min** — VP Engineering + Head of Trust & Safety.

Pages NEVER auto-resolve. The primary on-call must explicitly resolve
after confirming the comms timeline below was followed.

## 2. Comms timeline

| Time from detection | Action | Owner |
| --- | --- | --- |
| `T+0`  | Auto-post safety message to parent ↔ teacher thread via `POST /api/comms/threads/:id/messages` (S13) | responsible-ai-svc |
| `T+0`  | Auto-record `RESPONSIBLE_AI_CRISIS_ESCALATED` in audit-svc | responsible-ai-svc |
| `T+5m` | Primary on-call confirms parent has read the thread message; if not, calls the registered parent phone number on file | AI safety on-call |
| `T+5m` | Notify the learner's assigned teacher via the same thread + a direct comms-svc DM | AI safety on-call |
| `T+1h` | Notify the district admin (B2B tenants) or the family-svc primary contact (B2C tenants) | AI safety on-call |
| `T+24h` | File the post-incident review (template below) | AI safety on-call |

## 3. Legal trigger — mandated-reporter check

All staff who touch a crisis incident are mandated reporters under their
licensing jurisdiction. The on-call MUST:

1. Within 1 hour of the page, decide whether the disclosure meets the
   state-level mandated-reporter threshold (district-by-district
   reference at `docs/compliance/mandated-reporter-matrix.md`).
2. If yes, file the report with the appropriate Child Protective
   Services hotline AND notify Legal via the `#legal-oncall` Slack
   channel within 4 hours.
3. Record the report number (or "not required, reason: …") in the
   post-incident review.

Failure to follow this step is itself reportable to Trust & Safety
leadership.

## 4. Post-incident review template

Open a new doc under `docs/ai-safety/incidents/YYYY-MM-DD-<short>.md`
with these sections (do not include learner PII — reference by
correlation_id only):

```
## Incident header
- correlation_id:
- detected_at (UTC):
- crisis category:
- tenant_id:
- learner_id:                 # internal id only, never raw PII
- detector layer that hit:    # regex | classifier | judge
- llm provider in use:        # band only, no model id
- responsible_ai_evaluation_total verdict at decision time:

## Timeline
T+0    detection
T+…    page acknowledged by …
T+…    parent thread post confirmed read
T+…    teacher notified
T+…    district admin / family contact notified
T+…    mandated-reporter decision (report number or n/a)
T+24h  post-incident review filed

## What worked
- …

## What did not work
- …

## Action items
- owner / due-date / tracking issue
```

Action items must be filed as GitHub issues with the
`ai-safety/crisis` label and assigned an owner before the review is
closed.

## 5. False-positive handling

If the on-call concludes the signal was a false positive (e.g. a
homework question about a history topic that lexically matched the
crisis keyword bank):

1. Add the input to `services/responsible-ai-svc/__tests__/fixtures/red-team/negatives/`
   with a `notes` field explaining the source.
2. Open a tracking issue tagged `ai-safety/red-team-expansion`.
3. Do NOT silently relax the detector — go through the standard PR +
   security-review flow per `docs/SPRINT_12_SECURITY_REVIEW.md`.

## 6. Flag-flip gating

The `responsibleAiGuardrails` feature flag stays `false` by default
even after this sprint merges. The flip itself is the canary-soak
step described in `docs/SPRINT_12_SECURITY_REVIEW.md`:

1. Enable the flag in staging for **48 hours** with the red-team
   regression running on every PR + nightly.
2. Verify staging metrics:
   - `responsible_ai_block_total` increasing as expected on the
     synthetic red-team traffic.
   - `crisis_escalation_total` matches the synthetic crisis count
     (no missed pages).
   - `tenant_llm_cap_exceeded_total` zero or expected (capped test
     tenants only).
3. Get sign-off from: Trust & Safety lead, Engineering Director, and
   Legal (mandated-reporter language reviewed).
4. Flip in production via the staged rollout: 10% tenants → 50% →
   100% with 1-hour soak between steps.
