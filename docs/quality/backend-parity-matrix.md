# Backend Feature Parity Matrix

> Sprint **GREEN-01** populated. Machine-checked by
> `pnpm backend:parity` (`scripts/backend-parity-check.mjs`).
>
> Snapshot taken: 2026-05-18 on branch `claude/aivo-lms-production-ready-h2gNJ`.
>
> **Rule:** A feature is **green** only when it has real persistence, route
> behavior, auth / role / tenant / consent enforcement, audit logging where
> applicable, and unit + integration tests. **Type-only** existence does not
> count as green. Greps can have false negatives, so any service that the
> machine marks red on a single dimension must still be human-reviewed.

## Snapshot summary

| Status | Count |
|--------|-------|
| 🟢 green  | 5 / 28 |
| 🟡 yellow | 3 / 28 |
| 🔴 red    | 20 / 28 |

## Per-service findings

The full live table is produced by `pnpm backend:parity`. Selected
production-blocker findings:

| Service | Status | What's red |
|---------|--------|-----------|
| **identity-svc**       | 🔴 | uses `appendAudit` so audit detected, but greps flagged no `auditEvents` import on a sufficient surface — see live run. |
| **family-svc**         | 🔴 | **no audit event emission** on parent/learner ownership routes; consent-sensitive |
| **assessment-svc**     | 🔴 | **no audit event emission** despite handling baseline submissions |
| **billing-svc**        | 🔴 | has `emitBillingAudit` lib but greps still find sensitive routes (verify with human review) |
| **learning-svc**       | 🔴 | LessonRun routes emit no audit events — consent-sensitive |
| **tutor-svc**          | 🔴 | tutor runtime emits no audit events for AI generations — required by responsible-AI policy |
| **homework-svc**       | 🔴 | no auth middleware, no `@aivo/db` persistence detected — Homework Helper data plane stub |
| **brain-svc**          | 🔴 | brain profile routes have **zero unit tests** and emit no audit events |
| **subject-brain-svc**  | 🔴 | no auth, no tenant, no audit, no db — looks like a stub data plane |
| **curriculum-svc**     | 🔴 | Python service has no `Depends(...)` auth, no tenant scope, no unit tests — curriculum lookup is unauthenticated |
| **data-governance-svc**| 🔴 | Python service has no auth on DSAR/export/delete routes — **P0 privacy risk** if confirmed |
| **responsible-ai-svc** | 🔴 | Python service has no auth, no tenant, no audit — safety service itself is unauthenticated |
| **ai-svc**             | 🔴 | no unit tests; one `STUB_` / placeholder marker detected; no audit |
| **comms-svc**          | 🔴 | notification dispatch has no audit log emission |
| **admin-svc**          | 🟢 | passes |
| **engagement-svc**     | 🟡 | one suspicious marker; otherwise complete |
| **integrations-svc**   | 🟡 | no unit tests; one suspicious marker |
| **tenant-svc**         | 🔴 | no auth/tenant detection in source |
| **alerts-proxy-svc**   | 🔴 | no auth detected |
| **audit-svc**          | 🔴 | no auth on the audit service itself — **P0 if confirmed** |
| **integration-svc**    | 🔴 | no auth, no tenant, no db |
| **math-recognizer-svc**| 🔴 | no auth |
| **science-solver-svc** | 🔴 | no auth |
| **recommendation-svc** | 🔴 | no auth, no tenant |
| **status-page-svc**    | 🔴 | no DB persistence detected (may be intentionally stateless — re-classify if confirmed) |
| **problem-session-svc**| 🔴 | session ledger has no auth |
| **research-svc**       | 🔴 | no auth, no unit tests |
| **i18n-svc**           | 🟢 | passes its lenient contract |

## How to reproduce

```bash
pnpm backend:parity
```

The script:
- enumerates every service under `services/*`
- scans TS + Python source for auth / tenant / audit / db / route idioms
- looks for integration test references in `tests/integration/**`
- detects suspicious markers (`TODO production blocker`, `MOCK_`, `STUB_`,
  `throw new Error("not implemented")`, `coming soon`, etc.)
- prints per-service status and exits non-zero on any required failure

## Known limitations of this gate

1. **False negatives are possible.** Greps cannot detect every auth idiom
   (e.g., custom decorators, route-level guards declared in `preHandler`
   chains, or framework-level middleware applied via `app.addHook`).
   Confirm reds manually before declaring P0.
2. **Auth strength is not measured.** A service can pass the auth grep
   while still being vulnerable (e.g., trust on path, missing role check).
   GREEN-12 security:audit will tighten this.
3. **Audit emission completeness is not measured.** A service can emit a
   single audit row and pass this gate while missing dozens of required
   events. GREEN-04 / GREEN-06 will tighten.
4. **Integration test references are pattern-matched** by service name in
   `tests/integration/**`. A test that exercises the surface via a generic
   client without naming the service will be missed.

## Sensitive-domain coverage roll-up

| Domain (from sprint) | Status |
|----------------------|--------|
| 1. Identity / auth | 🔴 (audit gap) |
| 2. Consent + age gates | tracked in consent:audit (passing) |
| 3. Parent onboarding | tracked in onboarding:audit (passing) |
| 4. Learner profile | 🔴 family-svc audit gap |
| 5. Parent assessment | 🔴 assessment-svc audit gap |
| 6. IEP upload + extraction | not separately surfaced — needs human review |
| 7. Brain profile | 🔴 brain-svc tests + audit |
| 8. Subject brain | 🔴 subject-brain-svc stub |
| 9. Curriculum / skill graph | 🔴 curriculum-svc unauthenticated |
| 10. Baseline | 🔴 assessment-svc audit gap |
| 11. Mastery map | not surfaced separately |
| 12. LessonRun | 🔴 learning-svc audit gap |
| 13. Today's Mission | rolled into learning-svc |
| 14. Homework Helper | 🔴 homework-svc no auth + no db |
| 15. Tutor runtime | 🔴 tutor-svc audit gap |
| 16. Responsible AI | 🔴 responsible-ai-svc unauthenticated |
| 17. TTS / read-aloud | not surfaced as its own service |
| 18. Rostering | rostering:audit (passing structurally) |
| 19. Teacher assignments | not surfaced — needs human review |
| 20. Notifications | 🔴 comms-svc audit gap |
| 21. Billing / entitlements | 🔴 billing-svc — verify with human review |
| 22. Admin audit logs | 🔴 audit-svc no auth detected |
| 23. DSAR / export / delete | 🔴 data-governance-svc unauthenticated |
| 24. AI cost / quality monitoring | not surfaced as its own service |

## What GREEN-01 did NOT do

- Did not fix any of the 20 red findings. Fix work belongs to follow-up
  hardening sprints under each domain owner.
- Did not seed integration tests for services that lack them.
- Did not weaken or allowlist the scanner to clear findings.
