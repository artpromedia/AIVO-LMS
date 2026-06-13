# Reveal copy rubric — "Would a parent of a newly-diagnosed child feel seen?"

**Sprint:** C-14 (the full reveal, storyboard screens 0–7).
**Scope:** every parent-facing string in the brain-clone reveal — the stitched
flow (`app/parent/learners/[learnerId]/brain-clone-watch/`), keyed under the
`brain_clone` i18n namespace.

This is the Definition-of-Done rubric the report calls for. Each screen's copy
is checked against it and the pass is recorded below. The persona it serves: a
parent who has just received a diagnosis for their child, opening this product
for the first time, braced for one more deficit report. The reveal has to read
as *a story about a person they love*, not a system log.

## The checklist

A screen passes when **all** of the following hold:

1. **Strengths-first.** The first substantive thing the parent reads about
   their child is something the child is good at or loves — never a deficit, a
   level, or a gap.
2. **No deficit-leading.** No screen opens on what's wrong, missing, or behind.
   Growth framing throughout ("starting point, not a label").
3. **No jargon.** No "system / template / version / master / clone-engine /
   functioning level" vocabulary on screen. Plain, warm, parent language.
   (Enforced by `lib/i18n/brain-clone-keys.test.ts`, which bans
   `template|system|master` and `v#.#` in stage titles.)
4. **No unverifiable claims.** Nothing the backend can't honor — no encryption /
   rollback / "no data leaves this device" claims (C-03 deleted these; the gate
   bans `AES`). No fabricated grade-equivalents (`scoreToGradeEquiv` stays
   deleted; no score×grade math).
5. **Every number is explained.** Any count or signal shown traces to a real
   input the parent can recognise (their answers, the baseline, a named
   teammate, the IEP). No naked statistics.
6. **Provenance is honest.** Where the reveal attributes an insight ("You told
   us", "Her baseline showed", "Ms. Rivera observed") it is backed by a real
   `source` field; a claim with no backing data is not shown at all.

## Per-screen pass

Legend: ✅ pass · n/a where a criterion doesn't apply to that screen.

### Screen 0 — Notification + change timeline (C-13, cohesion pass)
- Deep-links into the stitched flow; copy unchanged beyond cohesion. Vocabulary
  matches the reveal ("learning profile", not "brain state").
- 1 ✅ (the notification frames a ready *profile*, not a deficit) · 2 ✅ · 3 ✅
  · 4 ✅ · 5 n/a · 6 n/a.

### Screen 1 — Inputs assembling (`reveal_inputs_*`)
- Title: *"Everything that shaped {name}'s profile."* Caption: *"Real input from
  the people who know {name} — and from {name}'s own adventure. Nothing was made
  up."*
- Each card is a **real contribution count** ("11 sections answered", "23
  questions answered", "2 observations shared", IEP "on file and read
  carefully"). Counts come straight from `confidenceSignals` /
  `completedSections` / collaborator insights / IEP presence.
- 1 ✅ (leads with *who was listened to*, warmly) · 2 ✅ · 3 ✅ · 4 ✅ (no
  fabricated inputs — caption says so explicitly) · 5 ✅ (every count explained
  by its source) · 6 ✅. **Empty state** ("we're still gathering input") passes
  too — no blank, no apology.

### Screen 2 — Strengths first (`building_strengths_*`, recap)
- Title: *"What lights {name} up."* The parent's own words first, then baseline-
  strong subjects, then interests. Where the baseline surfaces an observed-
  behaviour strength it leads; absent that (the web-v2 default today), it
  degrades to the parent's strengths with no fabrication.
- 1 ✅ (this is the strengths-first beat by construction) · 2 ✅ · 3 ✅ · 4 ✅
  · 5 n/a · 6 ✅ (observed strength only shown when real).

### Screen 3 — How she learns best (`reveal_learns_*`)
- Title: *"{name}'s operating instructions."* Each card is a small, actionable
  instruction ("Show it, then let {name} try — visuals land first") with a
  **source chip** ("You told us" / "{name}'s baseline showed" / "Their therapist
  observed") and a **confidence dot** in plain words ("We're fairly sure" / "A
  promising sign" / "An early signal").
- 1 ✅ (framed as how the child *thrives*, not deficits) · 2 ✅ · 3 ✅ (no
  jargon; "operating instructions" is a warm metaphor, not system-speak) · 4 ✅
  (confidence shown honestly, never overclaimed) · 5 ✅ (every chip = a real
  source; confidence = the documented `deriveConfidence` rule) · 6 ✅ (a card
  with no backing source is not rendered — proven by tests). **Empty/partial
  states** pass.

### Screen 4 — Where we'll start (`reveal_start_*`)
- Title: *"{name}'s starting points."* Caption: *"Every subject is a place to
  grow from — not a label. We'll start where {name} is and move at a comfortable
  pace."* Estimates are qualitative + growth-framed ("just starting — we'll begin
  gently"). Footnote: *"These are starting points, not labels. They'll change as
  {name} learns."*
- 1 ✅ · 2 ✅ (the most deficit-prone screen, deliberately reframed as growth) ·
  3 ✅ · 4 ✅ (**no grade-equivalent / no number** — Decision D4(b): grade
  language would come only from the curriculum-svc catalogue, which is not wired
  into web-v2, so per the pre-decided fallback we ship qualitative framing only;
  documented in `lib/learner/reveal-assembly.ts`) · 5 ✅ · 6 ✅. **Empty state**
  passes.

### Screen 5 — Check our understanding (C-05, cohesion pass)
- The correction screen; consumed unmodified beyond vocabulary cohesion. Frames
  correction as collaboration ("check & adjust"), not error-fixing.
- 1 n/a · 2 ✅ · 3 ✅ · 4 ✅ · 5 ✅ · 6 ✅.

### Screen 6 — Ceremony (C-06, cohesion pass)
- Recap: *"You're approving the starting profile AIVO will teach from — you can
  change it anytime, and it stays private to your family and the team you
  invite."* An honest, reversible, privacy-true sentence.
- 1 n/a · 2 ✅ · 3 ✅ · 4 ✅ (the privacy claim is one the backend honors —
  family + invited team only) · 5 ✅ · 6 ✅.

### Screen 7 — What happens next + share artifact (`next_*`, `share_*`)
- Next: *"{name} is ready to start."* The first-week preview reuses the
  `pickTodaysMission` data (Suite A-07's next-week view is a separate read-only
  BFF surface; the celebration screen uses the mission picker per C-06).
- Share: *"Share {name}'s strengths — a little card of what makes {name} shine,
  safe to send to family. No levels, no labels."* The card carries **only** the
  first name, strengths, and interests (safe by construction — see Privacy note).
- 1 ✅ (ends on the child's strengths — the artifact is strengths-only) · 2 ✅ ·
  3 ✅ · 4 ✅ · 5 ✅ · 6 ✅.

## Privacy note — the share artifact

The strengths-only share artifact is **safe by construction**, not by review
alone:

- The content type `ShareArtifactContent` (`lib/learner/reveal-assembly.ts`) has
  exactly three fields: `firstName`, `strengths`, `interests`. There is no field
  on it that could carry a level, accommodation, diagnosis, or source.
- The builder `buildShareArtifact` is the only producer; it draws from the
  parent's "good at" / "loves" words and baseline-strong *subject names* only.
- A content-safety test (`reveal-assembly.test.ts`) asserts the field surface is
  exactly those three keys AND scans the serialised output for a sentinel list
  of banned values (diagnoses, accommodation slugs, level words, "baseline",
  "collaborator") — none may appear.
- The render-level test (`reveal/share-artifact.test.tsx`) re-scans the rendered
  card DOM for the same sentinels and confirms the card shows the **first name
  only**, never the display name (which could carry a surname initial).

This is reviewed against the product's child-privacy rules (FERPA / COPPA child-
profile handling, ADR 0042): the artifact discloses nothing about the child's
needs, performance, or clinical profile — only what they love and are good at.

## Verification substitutions (no browser in CI)

Playwright is not installed in this environment. The screenshot DoD is
substituted with render tests that assert the load-bearing behaviour:

- **Screen order** — `reveal/reveal-flow.test.tsx` walks inputs → strengths →
  learns → start → complete and checks the per-screen advance events fire in
  order.
- **Source-chip / confidence-dot backing** — same suite asserts each chip + dot
  traces to a real source, and that an instruction with no backing renders no
  card.
- **Empty/partial variants** — zero-contributor (screen 1) and no-backed-facet
  (screen 3) designed states are asserted.
- **Share-artifact content safety** — the field-surface + sentinel scans above.
- **Funnel computability** — `reveal-telemetry.test.ts` proves
  `revealEventsFromAuditLogs` → `computeRevealFunnel` yields conversion +
  time-to-approve from `reveal.*` audit rows.

The `@a11y` axe coverage for the reveal route is added to
`e2e/role-a11y.playwright.ts` (incl. the reduced-motion full path) and rides CI
where Playwright is available.
