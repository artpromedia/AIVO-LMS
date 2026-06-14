# Apps / RBAC / Onboarding Remediation — Sprint Plan

> **Track:** AIvo multi-app topology, RBAC/caregiver grants, onboarding state machine, and learner-PIN authentication.
> **Source of truth:** `aivo-apps-rbac-onboarding-report.md` (repo root) — "AIvo Multi-App, RBAC & Onboarding-Flow Audit", 2026-06-13.
> **Authored:** 2026-06-14. This is a prompt-authoring plan only. Do **not** execute any sprint until the owner explicitly says so.

## Verification summary and drift notes

The report's key evidence was re-verified against the current tree before planning:

| Report claim | Current-code result | Planning impact |
|---|---|---|
| `createLessonRun` enforces `brain.cloneStage === "approved"` | Verified: `apps/web-v2/lib/db/repos.ts:2753-2763` returns `brain_not_approved` when clone stage is not approved. | This reconciles the contradiction with the older `aivo-assessment-ux-report.md`, which claimed the live web stack did not enforce the teach gate. Current code wins. This track does **not** duplicate Assessment-UX C-01; it focuses on PIN/app entry and state-machine gating. |
| Generic `requireLearnerScope` permits non-parent/non-learner same-tenant access | Verified: parent and learner branches are scoped, then all other roles only call `getLearner(learnerId, tenantId)` at `apps/web-v2/lib/bff/guards.ts:57-92`. | Sprint 02 is the second security blocker and must land before expanding caregiver/teacher/therapist surfaces. |
| identity-svc PIN login compares plaintext `users.pin` | Verified: `/api/auth/pin-login` requires only `parentId` and `pin`, then queries `eq(users.pin, pin)` at `services/identity-svc/src/routes/auth.ts:1064-1122`. | Sprint 01 must remove this production path, not merely harden web-v2 mock storage. |
| learner creation stores plaintext PIN | Verified: `services/identity-svc/src/routes/users.ts:356-362` inserts `pin: body.pin`. | Sprint 01 owns schema/service migration and deletes plaintext write. |
| Web PIN setup is not clone/approval gated | Verified: `/onboarding/pin` posts directly to BFF and routes to `/onboarding/parent-verify`; `apps/web-v2/app/onboarding/pin/page.tsx:30-103`. | Sprint 03 ships an immediate server-side gate before the full state machine. |
| Web login lacks learner/adult toggle | Verified: web login form renders hidden `role=parent`; `apps/web-v2/app/login/_components/login-form.tsx:68-70`. | Sprint 05 owns web toggle after Sprint 01's secure PIN contract exists. |
| Mobile PIN ignores selected learner in auth request | Verified: `PinScreen` reads `learnerId` param but calls `loginWithPin(newPin, parentId.trim())`; `apps/mobile/app/(auth)/pin.tsx:38-71`, `apps/mobile/hooks/useAuth.ts:211-216`. | Sprint 01 updates the contract and mobile caller; Sprint 05 polishes the login-toggle UX. |

## Cross-track coordination

| Existing track | Coordination point |
|---|---|
| `sprint-prompts/assessment-ux/SPRINT-PLAN.md` | Assessment-UX C-01 previously owned a server-side teach gate; current code already has `createLessonRun` approval gating. This track must not remove or weaken it. Assessment-UX C-04/C-06/C-12 touch brain approval surfaces and the one-gate contract; Apps/RBAC Sprint 03 must coordinate by using the current `cloneStage === "approved"` precondition for PIN activation without redesigning the full approval ceremony. |
| `sprint-prompts/SPRINT-PLAN.md` Suite B | Suite B-01 and Assessment-UX C-03 may change parent-facing brain-clone vocabulary/readiness labels. Apps/RBAC Sprint 03 and Sprint 04 should reuse those names if already landed and avoid duplicating copy rewrites. |
| Functional content/creator track | Creator jobs call `createLessonRun`; they already inherit the teach gate. Apps/RBAC Sprint 04 state-machine work must model creator/pre-generation as blocked until brain approval/PIN-ready as appropriate, without weakening creator scheduler behavior. |

## Sprint order and stack designation

| # | Sprint file | One-line goal | Stack designation | Gaps / remediations closed |
|---|---|---|---|---|
| 01 | `sprint-01-secure-learner-pin.md` | Replace plaintext learner PINs with hashed, learner-bound, locked-out identity-svc credentials and update mobile/web callers to `{ parentId, learnerId, pin }`. | `services/identity-svc`, `apps/mobile`, `apps/web-v2` BFF client/tests, DB/schema | 🚨 Gap 1 / R1; Gap 6 contract portion; 🔴 PIN hashed-at-rest, 🔴 PIN lockout, learner-session-scope hardening |
| 02 | `sprint-02-role-aware-child-scope.md` | Centralize child-scoped authorization so caregiver/teacher/therapist access is grant/roster-based, never same-tenant existence. | `apps/web-v2` BFF/auth/data tests; microservice scope audit where routes are directly exposed | 🚨 Gap 2 / R2; 🟡/🚨 child-scoped guard; caregiver grant enforcement |
| 03 | `sprint-03-pin-after-approval-gate.md` | Make learner PIN activation and app handoff impossible until the brain trust ceremony has produced an approved profile. | `apps/web-v2`, `apps/mobile` setup surfaces | Gap 3 / R4; approval-vs-PIN-access key finding; parent-creates-PIN capability cell |
| 04 | `sprint-04-onboarding-state-machine.md` | Replace ad-hoc readiness redirects with an explicit persisted onboarding state machine including contributor-awaited policy. | `apps/web-v2` persistence/repos/BFF/UI; optional service extraction if project conventions demand it | Gap 4 / R3; onboarding state persistence, legal transitions, contributor branch |
| 05 | `sprint-05-login-toggle-and-session-parity.md` | Ship the explicit Learner-PIN vs Adult-auth login toggle on web and mobile with role-safe learner sessions. | `apps/web-v2`, `apps/mobile`, `services/identity-svc` verification | Gap 5 / R5; remaining Gap 6 UX parity; ⬜ web login toggle; mobile toggle polish; adult role routing verification |
| 06 | `sprint-06-caregiver-rbac-variant.md` | Fully wire caregiver as a server-enforced, capability-scoped parent variant without expanding access beyond grants. | `apps/web-v2`, care-team persistence/BFF, caregiver UI/tests | R6; caregiver topology depth; caregiver grant enforcement completeness |

## Dependency graph

```text
01 secure PIN ─┬─> 03 PIN after approval ─┬─> 04 onboarding state machine ─┬─> 05 login toggle/session parity
               │                          │                                └─> 06 caregiver RBAC variant
02 role-aware scope ───────────────────────┘
```

Rules:
- **Sprint 01 must land first.** Until R1 lands, no sprint may build new functionality on top of the insecure PIN path.
- **Sprint 02 must land before Sprint 06** and before any sprint expands caregiver/teacher/therapist access surfaces.
- **Sprint 03 can land before Sprint 04.** It is the immediate server-side PIN-gate precondition; Sprint 04 formalizes that gate inside the state machine.
- **Sprint 05 depends on Sprint 01** because web/mobile login must use the secure `{ parentId, learnerId, pin }` contract.

## Coverage map

### Gap coverage

| Audit gap | Severity | Sprint owner(s) | Notes |
|---|---:|---|---|
| Gap 1 — plaintext learner PINs in identity-svc | 🚨 | Sprint 01 | Owns production identity-svc hashing, verification, migration, lockout, and removal of `users.pin = pin`. |
| Gap 2 — child-scoped IDOR risk for non-parent roles | 🚨 | Sprint 02 | Owns centralized role-aware scope and cross-child 403 tests. |
| Gap 3 — PIN creation not tied to clone completion/approval | ⚠️ | Sprint 03, then Sprint 04 | Sprint 03 ships immediate server precondition; Sprint 04 models it as a legal transition. |
| Gap 4 — contributor-awaited branch undefined | ⚠️ | Sprint 04 | Requires owner decision on contributor policy before implementation. |
| Gap 5 — web login lacks learner/adult toggle | ⚠️ | Sprint 05 | Must not be attempted until Sprint 01 secure PIN path exists. |
| Gap 6 — mobile PIN flow does not bind selected learner | ⚠️ | Sprint 01, Sprint 05 | Sprint 01 changes auth contract/caller; Sprint 05 completes parity UX and routing behavior. |

### Remediation coverage

| Remediation | Sprint owner | Build steps and DoD carried in? |
|---|---|---|
| R1 — Replace plaintext learner PINs with hashed, learner-scoped credentials | Sprint 01 | Yes, copied verbatim and extended with file-level orders. |
| R2 — Centralize role-aware child scope checks | Sprint 02 | Yes. |
| R3 — Make onboarding an explicit state machine | Sprint 04 | Yes. |
| R4 — Reconcile brain approval and learner PIN/app entry | Sprint 03 | Yes. |
| R5 — Implement login toggle on web and harden mobile parity | Sprint 05 | Yes. |
| R6 — Fully wire caregiver as an RBAC-restricted parent variant | Sprint 06 | Yes. |

### Capability-matrix coverage for 🔴 / ⬜ / 🟡 with 🚨 risk

| Capability cell | Status in report | Covered by | Deferred? |
|---|---:|---|---|
| Child-scoped learner guard | 🟡 / 🚨 | Sprint 02 | No |
| PIN hashed at rest | 🔴 | Sprint 01 | No |
| PIN rate limit/lockout | 🔴 / ❓ | Sprint 01 | No |
| Web login toggle | ⬜ | Sprint 05 | No |
| Caregiver grant enforcement | 🟡 | Sprint 02 foundation, Sprint 06 complete variant | No |
| Parent creates PIN not clone/approval gated | 🟡 | Sprint 03, formalized Sprint 04 | No |
| Learner session scoping | 🟡 | Sprint 01 and Sprint 05 | No |

### Four-pillar target states

| Pillar | Target state after this track |
|---|---|
| App topology | Web and mobile expose the five role-scoped sub-apps with explicit role routing; caregiver is a capability-scoped variant rather than a route-only shell. |
| RBAC | Every child-scoped endpoint enforces role-aware server authorization: parent relationship, learner self-scope, teacher roster/team grant, caregiver accepted grant/capability, therapist accepted grant, admin permission/scope. |
| Onboarding state machine | Parent add learner → parent assessment → contributor branch → baseline → clone → approval → PIN → learner app is persisted as legal transitions with audit/history and tests. |
| Learner-PIN auth | identity-svc owns hashed PIN credentials, server lockout, selected-learner binding, learner-scoped sessions, and web/mobile login parity. |

## Decisions needed

| Decision | Gates sprint(s) | Options from report | Plan recommendation |
|---|---|---|---|
| Contributor-awaited policy | Sprint 04 | Wait for all contributors; wait until deadline; proceed immediately while accepting late input as later brain-change proposals. | Proceed after a short configurable deadline, with explicit parent override and late input folded into later brain-change proposals. Owner must decide. |
| PIN and approval ceremony | Sprint 03, Sprint 04 | Separate approval step before PIN vs PIN creation itself is approval. | Separate approval step; Sprint 03 enforces `cloneStage === "approved"` before PIN. Owner can veto. |
| Caregiver authority over brain changes | Sprint 06 | Caregivers may approve delegated low-risk sensory/regulation changes vs parent always approves initial brain. | Parent always approves initial brain; caregiver delegated approvals only after explicit capability grants and outside initial onboarding. |
| Sibling PIN collisions | Sprint 01 | Enforce distinct sibling PINs vs selected `learnerId` binding makes collisions harmless. | Contract must bind `learnerId`; optionally warn on duplicate PIN, but security must not rely on uniqueness. |
| Mobile parity depth | Sprint 05, Sprint 06 | Complete operational surfaces vs companion-lite surfaces. | Companion-lite is acceptable for teacher/therapist/caregiver mobile if every exposed capability is server-enforced and web remains full control plane. |

## How to execute

Open one sprint prompt in order and paste it into a fresh implementation session. Each prompt is self-contained and ends with a checkpoint instruction. Do not start the next sprint until the owner reviews the checkpoint.
