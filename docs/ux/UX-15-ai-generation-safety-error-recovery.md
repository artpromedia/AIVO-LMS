# UX-15 — AI Generation States, Safety States, and Error Recovery UX

> **Last refreshed**: 2026-05-17 — drafted in this sprint.
>
> **Source of truth.** Grounded in `apps/web-v2/lib/ai/tutor.ts` (`generateLessonPlanWithRetry`), `apps/web-v2/lib/ai/safety.ts`, `apps/web-v2/lib/db/repos.ts` (`createLessonRun`, the `/retry` BFF), `apps/web-v2/app/learner/lesson-runs/[lessonRunId]/page.tsx` (the `status === "generating" | "failed"` gate at line 58, the status Card at lines 57–86), `apps/web-v2/app/api/bff/learners/[learnerId]/lesson-runs/[lessonRunId]/{route,start,step,complete,retry}/route.ts`, and the rate-limit contract in `apps/web-v2/lib/rate-limit.ts` (`RATE_LIMITS.AI_GENERATION`).
>
> **Status legend:** ✅ shipped · 🟡 partial · ⬜ planned.

---

## 1. Why AI generation, safety, and error recovery share a doc

These three states all share one property: **the learner is waiting on AIVO, not the other way around**. The product cannot pretend instant success; it must be honest about the wait, transparent when something is blocked, and forgiving when something fails. Documenting them together prevents the three from drifting into inconsistent treatments (e.g., a calm "generating…" copy block paired with a panicked "ERROR 500" toast).

---

## 2. The four service states

Every AI-backed surface (lesson generation, baseline generation, brain profile build, homework helper turn, IEP extraction) resolves to one of four states:

| State              | Meaning                                                                                       | Surface treatment                          |
| ------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Ready**          | Content is generated, validated, ready to render                                              | Render normally                            |
| **Generating**     | Model is producing content; no result yet                                                     | Calm "thinking" state — see §3             |
| **Safety-blocked** | Content was produced but failed a safety check, or the request itself was blocked by a policy | Honest "we can't show this" state — see §4 |
| **Failed**         | Model errored, timed out, or rate-limited                                                     | Friendly retry state — see §5              |

The state is **server-resolved at the boundary** (BFF) and persisted on the record itself — `LessonRun.status`, `Baseline.status`, `IEPDocument.extractionStatus`, etc. The client never guesses.

---

## 3. Generating state

**The contract.** Honest about the wait, never deceptive about progress, never traps the learner.

**Web today** (lesson player): `lesson-runs/[lessonRunId]/page.tsx` lines 57–86 — when `lessonRun.status === "generating"`, the page renders a Card with the lesson title, a Badge with the status, and a copy block. ✅ shipped.

**Improvements** (⬜ planned):

- **Calm copy.** "Your tutor is getting your lesson ready" — never a percentage, never "almost done", never a fake progress bar. (A real progress bar invites the learner to read it as an unfulfilled promise.)
- **Estimated time, only if confident.** Show "Usually 10–20 seconds" only when we have a real distribution. Otherwise no number.
- **`aria-live="polite"`** on the status copy so SR users hear the change.
- **Escape hatch after a threshold.** After 10 seconds, surface a secondary CTA "Skip the warm-up — start in text mode" that creates a simpler lesson (degraded but functional).
- **Reduced-motion variant.** Replace any spinner with a static "thinking" icon when reduced motion is on (UX-14 §3).
- **Parent-side mirror.** `/parent/learners/[id]/lessons` shows the same status: parents see "generating" on the day's run, not silence.

**Triggers.**

- `startMissionAction` → `createLessonRun` → fires `generateLessonPlanWithRetry`; until it returns, status = `generating`.
- Quest chapter start → same.
- Baseline runner completion that auto-generates the first lesson → same.
- Teacher assignment → `createLessonRun` with `triggeredBy: "teacher_assignment"` → same.

**Generation timing budget.** The fallback chain (`Claude Opus 4.7 → Gemini 3.0 Pro → GPT-5.5`) gives us up to 3 attempts per lesson at ~6–10s each. P50 = single-provider success (≈8s). P95 = two-provider hop (≈18s). P99 = all-three-failed → state moves to **Failed** (§5). The 10s escape hatch above lands inside the P50 window for most learners.

---

## 4. Safety-blocked state

**The contract.** Tell the truth without exposing policy internals, and offer a path forward that doesn't require the learner to figure out what went wrong.

**Where it happens.** `lib/ai/safety.ts` is the central guard. It's invoked on every model output before persistence:

- Lesson plan generation — checked before `GeneratedLessonPlan` is written to the run.
- Homework helper turn — checked before the assistant message is appended.
- Tutor freeform output (rare; most outputs are templated) — checked.
- IEP extraction — checked (to ensure the extracted accommodations text contains no policy violation).

**States:**

- `unsafe_content` — the model output failed a content check. Don't show it.
- `unsafe_request` — the learner's input was flagged (e.g., self-harm signals). Route to support flow, not silent block.
- `policy_blocked` — administrative policy says no (e.g., a topic the district has disabled).

**Surface treatments.**

| State                                    | Learner copy                                                                                                                             | Parent copy (notification)                                                         | Action                                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `unsafe_content` (model output blocked)  | "Your tutor wants to try a different way of teaching this. Hold on a moment."                                                            | Optional, only if it happens more than 2× / week                                   | Auto-retry once with a tightened prompt; if it fails again, route to **Failed** state |
| `unsafe_request` (learner safety signal) | Soft Card: "It sounds like something might be hard right now. Would you like to talk to a grown-up?" with a button that pings the parent | **Immediate** push to parent: "Your child may need a moment. Open the app to see." | Pause the Stage; surface parent-support resources from `comms-svc` config             |
| `policy_blocked` (district policy)       | "This topic isn't part of your class right now. Let's try something else."                                                               | None                                                                               | Offer an alternate mission                                                            |

**Never:**

- Never log a policy error code to the learner.
- Never say "blocked" or "violation" or "unsafe" to a learner.
- Never silently swallow an `unsafe_request` — that is the one place a parent **must** be notified in real time.

**Audit.** Every safety-blocked outcome writes to the audit log with `eventType: "safety.blocked"` + the policy id + the redacted snippet. Reviewable in `/admin/platform/safety/review-queue`.

---

## 5. Failed state

**The contract.** The failure is the product's fault, not the learner's. Recovery is one tap.

**Today** (lesson player): when `lessonRun.status === "failed"`, the same Card renders a warning-toned Badge and (per `retry/route.ts`) a Retry button that re-fires `generateLessonPlanWithRetry`. ✅ shipped.

**Failure taxonomy.**

| Cause                                                                | Surfaced as                                                     | Auto-retry?                                                                     |
| -------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Network timeout from model provider                                  | "We had trouble reaching your tutor. Let's try again."          | Yes, once at the provider layer; surface to UI only if all three fallbacks fail |
| Rate limit hit (`RATE_LIMITS.AI_GENERATION`)                         | "AIVO is a little busy right now — try again in a minute."      | No — exposing user-level rate limit is correct                                  |
| Malformed model output (validation failure on `GeneratedLessonPlan`) | "Your tutor's plan didn't come together — let's try once more." | Yes, once with a stricter prompt; otherwise surface                             |
| All-providers-failed                                                 | Same as network timeout copy                                    | No further auto-retry; surface                                                  |
| Database / persistence error                                         | "Something on our side hiccuped. Try again."                    | No                                                                              |

**UI requirements** (⬜ where not shipped):

- One primary CTA: **Try again**. ✅ shipped.
- One secondary CTA: **Take a break** (returns the learner to home with no shame). ⬜.
- For the parent: the failed status is visible on `/parent/learners/[id]/lessons` so they know to check in.
- For the admin: aggregate in `/admin/platform/ai-generation` + `/admin/platform/ai/moderation` (failure rate per provider, per model, per hour).
- For SR: the status change announces via `aria-live="polite"` and focus moves to the Retry button after render.

**Cool-down.** After a third consecutive failure on the same lesson within 5 minutes, the Retry button is replaced with "Tell a grown-up there's a problem" → opens the parent comms-svc thread with context attached. This is the bottom of the safety net.

---

## 6. Error recovery on non-AI flows

The same friendly-error contract applies to non-AI failures (BFF errors, validation, permission, consent):

| Class                                  | Surfacing                                                                                             | Recovery                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------- |
| Validation (4xx)                       | Inline error under the field, `aria-describedby` linkage, never toast-only                            | Fix and resubmit            |
| Permission (`requirePageRole` / scope) | Per-route-group `error.tsx` (⬜ planned per UX-00 DD-01) with role-appropriate copy + a "Go home" CTA | Sign in / switch role       |
| Consent (`requireConsent`)             | Card explaining the missing consent + a CTA into `/parent/consent`                                    | Grant and return            |
| Rate limit (429)                       | Inline banner with reset time                                                                         | Wait                        |
| Network (offline)                      | Banner at top + queued writes                                                                         | Reconnect                   |
| Unknown 5xx                            | Per-group `error.tsx` with a "Try again" button + a request id the user can paste into Support        | Retry, then contact support |

**Never** render a stack trace, a SQL fragment, or a model-provider error string to any user surface. Those go to logs only.

---

## 7. Status messaging design system

Every "AIVO is doing something" surface uses one of three primitives, all defined in `components/ui/*`:

| Primitive                            | Purpose                            | A11y                                                    |
| ------------------------------------ | ---------------------------------- | ------------------------------------------------------- |
| `<GenerationStatus>` (⬜ planned)    | The "thinking" state from §3       | `role="status" aria-live="polite"`                      |
| `<RetryPanel>`                       | The "try again" state from §5      | `role="alert"` for first render; focus the Retry button |
| `<ConsentGate>` / `<PermissionGate>` | The "you can't do this yet" states | `role="status"`; linked CTA                             |

Three primitives, three contracts. No ad-hoc "Loading…" text. No bare `<Toast type="error">` for AI failures.

---

## 8. Telemetry

Every state transition emits an event to the observability layer:

| Event                     | Where                                              |
| ------------------------- | -------------------------------------------------- |
| `ai.generation.started`   | `createLessonRun` (and equivalents)                |
| `ai.generation.completed` | On success in `generateLessonPlanWithRetry`        |
| `ai.generation.failed`    | On final failure, with provider chain + last error |
| `ai.safety.blocked`       | On `safety.ts` rejection, with policy id           |
| `ai.retry.invoked`        | `/retry` BFF                                       |
| `error.rendered`          | Any role-group `error.tsx` render                  |
| `consent.gate.shown`      | `<ConsentGate>` mount                              |

These power `/admin/platform/ai-generation`, `/admin/platform/ai-costs`, `/admin/platform/ai/moderation`, and the Admin-Lite "AI failures" tab (UX-13 §5).

---

## 9. Deliverables

1. ✅ This contract.
2. ⬜ Promote the inline lesson-runs status Card into a reusable `<GenerationStatus>` primitive.
3. ⬜ Build the `<RetryPanel>` primitive with the cool-down behavior in §5.
4. ⬜ Wire the parent-side mirror of generating/failed state into `/parent/learners/[id]/lessons`.
5. ⬜ Wire per-route-group `error.tsx` (DD-01) using §6 copy.
6. ⬜ Implement the 10s escape hatch (skip-to-text-mode) for generation.
7. ⬜ Add the §8 telemetry events end-to-end and surface counts in `/admin/platform/ai-generation`.
8. ⬜ Audit existing surfaces for ad-hoc "Loading…" / "Error" text and replace with the three primitives.

---

## 10. Acceptance criteria

- [ ] No "AI is doing something" surface uses the word "Loading" or "Error" — only the three primitives' copy.
- [ ] Every generation state transition is announced via `aria-live="polite"` and emits a telemetry event.
- [ ] No policy / model / system error string ever appears in a learner or parent surface.
- [ ] An `unsafe_request` safety signal always pages the parent in real time.
- [ ] Three consecutive failures within 5 minutes route to the parent comms thread, not another Retry button.
- [ ] Reduced-motion preference replaces the generating spinner with a static icon.
- [ ] The per-route-group `error.tsx` re-renders with the role's chrome, not the global boundary.
- [ ] Admin-Lite Mode (UX-13 §5) shows the failure feed in real time.
