# Caregiver / teacher feedback loop (Sprint 5, G1/G2)

Teacher, caregiver, and therapist input improves service to the learner —
while parents keep approval authority. Care-team members **propose**;
parents **approve / decline / adjust**. Nothing mutates brain state without
parent approval (COPPA-safe).

## The loop

```
teacher / caregiver / therapist
   │  observation (family-svc POST /api/family/observations)
   │     → emits caregiver.observation.created  (@aivo/events)
   │  OR explicit suggestion (family-svc POST /api/family/suggestions)
   ▼
recommendation-svc
   │  observation-signal-transformer.ts
   │     observations + brain insights → typed LearnerSignals with
   │     source + confidence weight (therapist > teacher > parent > caregiver)
   │     metrics e.g. teacher_reports_focus_drop, caregiver_reports_sensory_overload
   │  recommendation-generator.ts
   │     observation-derived candidate rules fire → PENDING recommendations,
   │     each requiresParentApproval, evidence citing the contributing sources
   ▼
parent
   │  sees the recommendation with provenance
   │     ("2 teacher observations + 1 caregiver note")
   │  approves / declines / adjusts  (family-svc recommendation-effects)
   ▼
brain state mutates  (only on parent approval), snapshot cites the source
```

## Authority model

- **Teachers/caregivers/therapists** record observations and may propose
  adjustments. A suggestion becomes a `PENDING` recommendation — it never
  applies an effect directly (`family-svc/routes/suggestions.ts`).
- **Parents** retain the sole approval gate
  (`family-svc/routes/recommendation-effects.ts`, unchanged).
- Evidence carries `contributorRole` + `weight` so the parent always sees
  who flagged what.

## Where it lives

| Piece | File |
| ----- | ---- |
| Signal transform | `services/recommendation-svc/.../observation-signal-transformer.ts` |
| Candidate rules | `services/recommendation-svc/.../recommendation-generator.ts` |
| Provenance | `services/recommendation-svc/.../recommendation-evidence-builder.ts` (`describeProvenance`), `types.ts` |
| Suggestion route | `services/family-svc/src/routes/suggestions.ts` |
| Events | `packages/events` (`caregiver.observation.created`, `recommendation.suggested`) |
