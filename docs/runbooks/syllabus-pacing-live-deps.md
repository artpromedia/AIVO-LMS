# Syllabus alignment, pacing & holiday paths — live dependencies

> Remediation Sprint 11. These three headline features run through
> brain-svc behind the shared service token and FAIL CLOSED without it.
> `pnpm prod:check` (NODE_ENV=production / --strict) blocks a deploy that
> leaves them dead.

## What needs to be configured

| Variable | Where | Used for |
| --- | --- | --- |
| `INTERNAL_SERVICE_TOKEN` | web-v2, admin-svc, brain-svc clients | Service-to-service auth: pacing reads/writes, summer bridge, the Creator's internal pre-generation route |
| `BRAIN_SVC_URL` | web-v2 | Pacing-plan generation + `pacing/current` reads (term-syllabus alignment, holiday/summer-bridge focus) |
| `WEB_V2_INTERNAL_URL` | admin-svc | The Sunday-night Creator job's call into web-v2 |

Running services required: **brain-svc** (pacing engine, summer bridge) and
**curriculum-svc** (jurisdiction catalogue used for next-grade preview).

## Behaviour when configured

- Saving a full-term syllabus **auto-generates** the pacing plan
  (`handleSaveTermSyllabus` → `svcGeneratePlan`); the save response carries
  `pacing.status = "generated" | "failed"` and the manager UI shows it.
  The manual "Generate pacing plan" button remains for re-pacing after edits.
- `creator.weekly-generation` (admin-svc, Sunday 23:00 UTC) pre-generates
  each active learner's coming week via web-v2's internal creator route.

## Behaviour when NOT configured (dev default)

Every live path fails closed with a precise `UPSTREAM_UNAVAILABLE` /
`pacing.status="unavailable"` message naming the missing variable — never a
silent no-op and never fake data. This is by design; the production gate
exists so the closed state can't reach a real deploy.
