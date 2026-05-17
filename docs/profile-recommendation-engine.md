# Profile Recommendation Engine

The profile recommendation engine watches learner evidence — baseline,
lessons, homework, problem sessions, teacher/parent observations,
regression checks — and proposes typed profile changes for parent
review. Parents can **Accept**, **Amend**, or **Deny** each
recommendation. Approved and amended changes pass through typed effect
handlers that snapshot the Brain before and after and emit an audit
event.

## Recommendation Types

```ts
type ProfileRecommendationType =
  | "accommodation_add"
  | "accommodation_remove"
  | "functioning_level_change"
  | "delivery_level_change"
  | "mastery_adjustment"
  | "preferred_surface_change"
  | "tutor_strategy_change"
  | "self_regulation_support_add"
  | "sensory_setting_change"
  | "language_support_change"
  | "rebaseline_request"
  | "teacher_review_request";
```

## Generation Rules

Candidates are generated when:

- Scratchpad success rate is materially higher than no-scratchpad success.
- Learner repeatedly uses hints but improves after visual model.
- Geometry tasks improve with diagram surfaces.
- Long text prompts correlate with abandonment.
- Drag precision issues indicate motor-friendly alternatives.
- Repeated homework frustration indicates self-regulation supports.
- Mastery evidence crosses promotion or remediation threshold.
- Parent/teacher observation conflicts with current profile.
- Baseline and problem-session evidence support delivery-level adjustment.

A candidate **must** have either at least two independent supporting
signals or one high-confidence baseline signal. `hasSufficientEvidence`
enforces this and is locked by tests.

## Parent Workflow

```
POST /api/recommendations/:id/accept
POST /api/recommendations/:id/amend
POST /api/recommendations/:id/decline
```

- **Accept** → effect handler applies the proposed value.
- **Amend** → effect handler applies the amended value.
- **Decline** → records the reason and reduces repeat low-quality
  recommendations of the same type.

Each decision requires `actorRole: parent` (or `service`). Teachers,
school admins, and district admins receive 403 from
`requireParentApproval`.

## Effect Handlers

```
accommodation_add        -> update activeAccommodations
accommodation_remove     -> update activeAccommodations
functioning_level_change -> update functioningLevelProfile
delivery_level_change    -> update functioningLevelProfile.deliveryLevel
mastery_adjustment       -> merge into masteryLevels
preferred_surface_change -> update processProfile.preferredInteractionModes
tutor_strategy_change    -> merge into tutorStrategyProfile
self_regulation_support  -> update regulationSupports
sensory_setting_change   -> merge into sensoryProfile
language_support_change  -> merge into languageProfile
rebaseline_request       -> create rebaseline task (no Brain mutation)
teacher_review_request   -> create teacher review task (no Brain mutation)
```

Every applied effect produces a `BrainSnapshot` (before/after) and
sets `appliedAt`. Failed effects mark the recommendation `FAILED`
with the reason; they never mark it `APPLIED`.

## Audit

`buildRecommendationAuditEntry` builds the audit context (actor, role,
tenant, learner, before/after hashes) from the request. Audit emission
itself lives in `services/audit-svc` (Sprint 09).

## Feature Flag

The engine runs only when
`AIVO_FEATURE_PROFILE_RECOMMENDATIONS_V2=true`. The legacy
recommendation route in `services/family-svc` remains the default until
the flag is on.
