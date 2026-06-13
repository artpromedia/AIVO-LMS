# Sprint C-13 — Brain evolution: notify, re-acknowledge, and show what changed (storyboard screen 0)

**Stack:** `apps/web-v2` · `services/brain-svc` · `services/comms-svc`.
**Report items closed:** Strategic roadmap row "Brain evolution + re-approval"; §4.1 point 6 (no change notifications, no re-approval threshold, regression detections invisible); §4.2 **screen 0** (the review invitation) and the §4.2 mechanics' re-approval policy.

## Goal

At the end of this sprint, the Learning Brain stops changing silently behind the parent's back: the parent is notified when the profile is **ready for first review** (screen 0) and when it **meaningfully changes** afterwards; **structural** changes (functioning level, accommodations added/removed, tutor activation, IEP-derived shifts) require parent re-acknowledgement of the delta — non-blocking, with an N-day window — while mastery levels flow freely; a **"what changed since you approved"** timeline exists; and regression detections become parent-readable insights instead of unread `causal_analyses` rows.

## Context

All findings re-verified at HEAD `32ece1d3` (report §4.1 point 6):

- **What exists:** versioning + snapshots (brain-svc: approve bumps `version`, writes `parent_approved` snapshots — `routes/brain.py:357, 468-474`; web-v2: `revision` + approval records from C-06; snapshot history table `brain_state_snapshots`); a regression detector (`brain.py:766-869`) that writes `causal_analyses` rows with hypotheses ("Mastery in {domain} dropped by {x}%…") and optionally emits recommendation candidates; web-v2 regenerate correctly resets approval (`repos.ts:564-576`).
- **What's missing (verified absent):** any parent notification of brain change in either stack (no comms-svc template; nothing in web-v2 repos/notifications referencing brain changes); any re-approval threshold (post-approval, `episodic_memory`/engagement mutate freely — `brain.py:872-919`); any parent-facing change timeline; any parent-readable surfacing of `causal_analyses`.
- **The policy to implement (report §4.2 mechanics, verbatim):** "mastery-level changes flow freely; **structural** changes (functioning level, accommodations added/removed, new tutor activation, IEP-derived changes) set `pending_parent_review` on the **delta** (not blocking existing teaching), notify the parent, and require ack within N days." Choose N (default 14) as a constant with rationale; surface in the ADR-aligned contract from C-12 if landed.
- **Notification machinery:** comms-svc templates (`services/comms-svc/src/lib/templates.ts`) + `startSafeCron` job pattern (`services/comms-svc/src/index.ts:80`); web-v2 in-app notifications BFF (`app/api/bff/notifications/`) and notification preferences. Screen 0 copy (report §4.2): *"Maya finished her Discovery Adventure. AIVO has drafted her learning profile — it's waiting for you to review it." CTA "See what we learned."* — triggered on `cloneStage → cloned` (web-v2) / clone completion (brain-svc).
- **Where structural changes originate:** web-v2 — re-clone after a new baseline (`cloneBrainFromBaseline`, `repos.ts:691-706`), IEP upload effects, C-05 corrections (parent-authored — these are *not* notifications-to-self; exclude); brain-svc — amend/engagement/regression paths. Build the delta detection at the write paths that mutate accommodations/tutors/functioning level — enumerate them by grep and list in the Checkpoint.
- **Persona/bar:** notifications must feel like care, not surveillance noise — digest-style, plain language, strengths-respecting ("AIVO adjusted {name}'s supports — take a look"), honest about what changed and why, one CTA.

## Work orders

### DELETE
- None.

### CREATE
1. **Change-event capture:** a `brain_profile_changes` record (web-v2 persistence, memory+drizzle parity; shared-shape with brain-svc if C-12 landed): `(learnerId, revision, kind: mastery|structural, fields[], summary, source, requiresAck, ackedAt, createdAt)`. Written wherever structural mutations land (Context enumeration); mastery-only changes recorded with `requiresAck: false` (cheap, enables the timeline).
2. **Notifications:**
   - Screen 0 (clone-ready): in-app notification + email (new comms-svc template, copy per Context) on first transition to `cloned`; deduped (once per clone event); respects preferences.
   - Structural-change notice: in-app + email when a `requiresAck` change lands; includes the plain-language delta summary and the review CTA; batched if multiple changes land together.
   - A `startSafeCron` digest/reminder: un-acked structural changes older than 7 days get one reminder; expiry of the N-day window does **not** revoke teaching (non-blocking policy) — it escalates to a persistent in-app badge until acked. Ledger-capped like C-08's jobs.
3. **"What changed since you approved" timeline:** parent surface (extend `app/parent/learners/[learnerId]/brain-profile/` or a sibling route) rendering the change records + approval records (C-06) newest-first: human summaries ("Read-aloud turned on — recommended after her last 3 reading sessions"), ack buttons on pending structural deltas, link to the C-05 review screen to adjust rather than just acknowledge. All states (empty: "No changes since you approved — AIVO will tell you when something meaningful shifts").
4. **Regression surfacing:** parent-readable insight cards derived from `causal_analyses` (brain-svc read path — scoped per C-02) or the web-v2 equivalent signal: hypothesis text rewritten to parent language, never alarmist, always paired with a constructive next step. If the live web-v2 stack has no regression source of its own, surface the brain-svc analyses through an authorized BFF read and say so in the Checkpoint.
5. **Ack endpoint + server action** (parent-scoped, audited; ack recorded on the change record and in the audit/disclosure trail per C-12 conventions).
6. Tests per **Tests**; axe spec for the timeline route (`@a11y`).

### REFACTOR
1. brain-svc: the engagement/amend/regression write paths emit change records (or events the web layer persists) per the shared shape — placement per C-12's approved model; if C-12 has not landed, implement web-v2-first and mirror the shape, flagging the brain-svc half as the C-12-aligned follow-up *only if* the owner approved that sequencing (default order has C-12 before C-13).

### EDIT
1. C-06's screen 7 line about future notifications can now claim what is true — update its copy to "You'll get a note when this profile meaningfully changes" (it was deferred-truth in C-06).
2. i18n: all new strings, 10-locale parity (D7); comms templates follow existing conventions incl. preferences/unsubscribe links.

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **UX rules:** every state designed (loading, empty, error, success, resume); WCAG AA contrast on all changed UI; a reduced-motion variant for every animation; learner sensory/accessibility preferences honored wherever they apply; all user-facing strings added to the i18n catalog (`apps/web-v2/lib/i18n/messages/en.json`), never hardcoded; parent-facing copy is strengths-first, plain-language, free of "system/template/version" jargon — and free of any claim the backend cannot honor.
- **Trust rules (for any sprint touching approval, consent, or brain access):** enforcement lives server-side with regression tests against every lesson pipeline it guards; authorization tests prove a non-related role gets 403 and a teacher cannot read `disabilitySignals`; decline/reset paths archive — they never destroy a learner's work.

## Definition of done

Report strategic-row DoD, verbatim: **"Structural profile changes notify the parent and require acknowledgement; parents see a change timeline ('what changed since you approved'); regression detections surface as parent-readable insights, not just `causal_analyses` rows."** Plus screen 0: the clone-ready notification ships with the §4.2 copy intent.

Verification:
1. Runtime walks: (a) fresh clone → in-app + email notification fired (show both); (b) simulate a structural change (e.g. accommodation added via a re-clone) → change record `requiresAck`, notification, timeline entry, ack flow works, teaching never blocked (C-01 gate still passes for the approved profile); (c) mastery-only change → timeline entry, **no** ack demand, no email.
2. The 7-day reminder job selects exactly un-acked structural changes (test, ledger-capped); N-day expiry escalates to badge, never blocks.
3. A regression row renders as a parent-readable card (screenshot; copy review against the persona bar).
4. Parity/contract tests for the change store; authz (non-parent ack → 403); axe spec green; full suite green.

## Tests

- Change-capture unit tests per mutation path (the Checkpoint's enumerated list each get one).
- Notification dedupe + preference filtering; job selection tests.
- Timeline rendering states; ack authz.
- Run the full suite so C-01..C-12 stay green.

## Out of scope

- The full reveal cohesion pass and share artifact (C-14 — it consumes screen 0's notification).
- Recommendation-engine changes (`_maybe_emit_regression_candidates` stays as-is).
- Contributor-facing notifications (C-16).

## Depends on

- **C-06** (approval records anchor the timeline). **C-12 soft** (shared shape; default order runs C-12 first — flag explicitly if executed out of order). C-08's job conventions reused.

## Checkpoint

Summarize changed files; attach notification evidence (in-app + email), the timeline screenshots (pending-ack, acked, empty), the mastery-vs-structural behavioral proof, the regression card, and the enumerated mutation-path list with their capture tests. **Pause for owner review. Do not commit unless explicitly told to.**
