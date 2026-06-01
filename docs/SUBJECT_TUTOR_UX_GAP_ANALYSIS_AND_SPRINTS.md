# Subject & Tutor Learner-Experience Gap Analysis + Sprint Prompts

_Date: 2026-06-01 · Scope: `apps/web-v2`, `apps/mobile`, `packages/brand`,
`packages/learner-surfaces`, `services/tutor-svc` · Focus: **the 14 tutors and
the 12 subjects they deliver**, evaluated end-to-end on **web and mobile**._

> **Purpose.** Audit whether a learner gets a complete, high-quality experience
> for **every subject and activity, on both web and mobile**, for **every
> tutor**. Where there are gaps, this doc pairs each one with a ready-to-paste,
> self-contained sprint prompt.
>
> This complements the existing planning docs — it does **not** re-plan content
> authoring (`docs/quality/tutor-k12-coverage-gap-plan.md`), structural parity
> (`docs/quality/tutor-parity-matrix.md`), or route parity
> (`docs/mobile-parity.md`). Those cover _backend / catalog / content_. **This
> doc covers the client experience layer**: discoverability, the activity
> surfaces, per-subject tooling, and web↔mobile consistency.

---

## 0. The catalog (source of truth)

- **14 tutors** — `packages/brand/src/index.ts → TUTORS`:
  nova (Math), sage (ELA), spark (Science), chrono (History/Social Studies),
  pixel (Coding), echo (Speech), harmony (SEL), atlas (Geography),
  cadence (Music), vigor (PE/Health), lingua (World Languages),
  forge (STEM/Engineering), compass (Life Skills/Exec-Fn), muse (Creative Arts).
- **12 learner subjects** — `packages/brand/src/subjects.ts → LEARNER_SUBJECTS`.
  Only **4 are `productionReady: true`**: `reading`, `math`, `science`, `writing`.
- **Surface contract** — `packages/learner-surfaces/src/types.ts` declares **15
  `LearnerSurfaceType`s**; `SurfaceRouter/surface-type-map.ts → SUPPORTED_RUNTIME_TYPES`
  implements **10**.

---

## 1. Headline findings

The two clients are each incomplete **and inconsistent with each other**, in
opposite directions:

|                        | Web (`apps/web-v2`)                                                                                                                                                                                   | Mobile (`apps/mobile`)                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Subject visibility** | Only the **4 `productionReady` subjects** render; 8 are filtered out and unreachable (`app/learner/subjects/page.tsx:43-47`)                                                                          | **All brain domains** render with **no `productionReady` gate** (`app/(learner)/subjects/index.tsx:25`)                            |
| **Tutor reachability** | Tutor chat uses **hardcoded fictional personas**, not the 14-tutor catalog (`lib/learner/lesson-plan.ts:22-24,245`); only 6 subjects have a baseline-tutor mapping (`lib/learner/baseline-tutors.ts`) | **All 14 tutors** reachable via `/(learner)/tutor/[tutorSlug]` with correct entitlement gating                                     |
| **Activity surfaces**  | 10 of 15 implemented; 5 fall back                                                                                                                                                                     | Re-implements its **own** surface set (does not consume `@aivo/learner-surfaces`); ~6 full + 2 fallback; voice/video/audio missing |

So: **web hides most subjects but has the richer surface library; mobile exposes
every tutor but renders most activities with generic fallbacks.** A learner's
experience for a given subject depends heavily on which device they pick.

### 1a. Confirmed defects (small, high-value)

1. **4 orphan tutors.** `atlas`, `cadence`, `vigor`, `forge` have a full
   backend (mode + content pack + persona + avatar) but **no row in
   `LEARNER_SUBJECTS`**. There is no subject card to reach them, and no subject
   mastery domain behind them. (`packages/brand/src/subjects.ts` — grep the
   `tutorKey` values: atlas/cadence/vigor/forge never appear.)
2. **`art_canvas` entitlement mis-mapped.** It requires `cadence` (Music) but
   `art_canvas` belongs to `muse` (Art/Creative Arts).
   (`packages/learner-surfaces/src/entitlement/required-tutor.ts:41`.)
3. **`voice_response` gated to `lingua` only.** Speech therapy (`echo`) is the
   primary voice subject and is not in the map. (same file, `:42`.)
4. **Mobile speech input is orphaned from lessons.** `apps/mobile/hooks/useSpeechInput.ts`
   is fully implemented but only consumed by the homework-helper screen
   (`app/(learner)/homework/[sessionId].tsx`), **not** by the lesson/stage
   surface renderer (`MobileSurfaceRenderer.tsx` has no `voice_response` case).
   Echo (speech) lessons fall back to text on mobile.
5. **`mobile-parity.md` claims 100% parity** but is route-level only; it does not
   account for the surface-type and subject-visibility gaps above.

### 1b. Activity-surface gaps (the "each activity" axis)

`LearnerSurfaceType`s declared but **not implemented** (render the fallback on
web; absent or scratchpad-fallback on mobile):

| Surface                | Primary subject(s) / tutor             | Web         | Mobile              |
| ---------------------- | -------------------------------------- | ----------- | ------------------- |
| `reading_annotation`   | Reading/ELA — sage                     | fallback    | absent              |
| `science_diagram`      | Science — spark                        | fallback    | absent              |
| `drag_manipulative`    | Math (early) — nova; Exec-Fn — compass | fallback    | absent              |
| `graph`                | Math/Science — nova/spark              | fallback    | scratchpad fallback |
| `multi_step_workspace` | Math/Science — nova/spark              | fallback    | absent              |
| `voice_response`       | Speech — echo; Languages — lingua      | implemented | **not wired**       |
| `video` / `audio`      | media-rich lessons (all)               | implemented | absent              |

Even the **4 production-ready subjects** therefore deliver a partly-generic
activity experience (e.g. reading comprehension has no annotation surface;
science has no diagram-labelling; math has no manipulatives/graphing).

### 1c. Per-subject / per-tutor coverage matrix (client experience)

Legend: **F** full · **P** partial (reachable but generic/fallback surfaces or
no per-subject tooling) · **H** hidden/unreachable · **O** orphan (no subject row).

| Tutor → Subject              | Web                        | Mobile                     |
| ---------------------------- | -------------------------- | -------------------------- |
| nova → math                  | P (no manipulatives/graph) | P (math-expr only)         |
| sage → reading               | P (no annotation)          | P                          |
| sage → writing               | P                          | P                          |
| spark → science              | P (no diagram/sim)         | P                          |
| harmony → social (SEL)       | H                          | P (no SEL tools)           |
| echo → speech                | H                          | P (no voice surface)       |
| compass → executive-function | H                          | P                          |
| compass → life               | H                          | P                          |
| muse → art                   | H                          | P (art_canvas, mis-gated)  |
| chrono → social-studies      | H                          | P (no timeline/map)        |
| lingua → world-languages     | H                          | P (no pronunciation)       |
| pixel → coding               | H                          | P (coding_sandbox works)   |
| atlas → (geography)          | O                          | O (tutor-only, no subject) |
| cadence → (music)            | O                          | O                          |
| vigor → (PE/health)          | O                          | O                          |
| forge → (STEM/engineering)   | O                          | O                          |

**Net:** 0 subjects are "Full" on either client today; web has 4 reachable
(all Partial), mobile has 12 reachable (all Partial), and 4 tutors are orphaned
on both.

---

## 2. Sprint-by-sprint prompts

> Each prompt is self-contained — paste it as the task for one focused PR. Keep
> each on its own branch, behind the relevant feature flag where one exists, with
> tests and the existing gates (`pnpm tutor:parity`, `pnpm mobile:parity:md`,
> `pnpm curriculum:coverage`) green before merge. Sprints 0–3 are sequenced
> (foundation); Sprints 4–9 (per-subject experience) can run in parallel once 0–3
> land; Sprint 10 closes out.

---

### Sprint 0 — Build the per-(tutor × subject × platform) experience gate ✅ landed

> Shipped: `scripts/subject-tutor-ux-check.mjs` (`pnpm ux:matrix`), regenerating
> `docs/quality/subject-tutor-ux-matrix.md` and ratcheting against
> `docs/quality/subject-tutor-ux-baseline.json`. First run confirms the audit:
> **8 subjects hidden on web**, **4 orphan tutors** (atlas/cadence/vigor/forge),
> catalog integrity green. The gate hard-fails on regression (subject P→H, tutor
> linked→orphan, or any catalog-integrity break) and warns on improvements so the
> baseline is updated in the same PR. Sprints 1+ improve cells and update the baseline.

```
Create a machine-checked "experience matrix" that becomes the source of truth
and regression guard for every later sprint. Add scripts/subject-tutor-ux-check.mjs
(wired as `pnpm ux:matrix`) that, for each of the 14 tutors and 12 subjects in
@aivo/brand, asserts the full client path exists on BOTH web and mobile:

For each LEARNER_SUBJECTS row:
- web: a route renders it (apps/web-v2/app/learner/subjects/[subjectId]) AND it is
  either productionReady or explicitly flagged "coming-soon" (not silently dropped).
- mobile: a route renders it (apps/mobile/app/(learner)/subjects/[subjectId]).
- the subject's tutorKey exists in TUTORS, has a TutorDefinition in the registry,
  and a content pack.

For each TutorKey:
- it is reachable from at least one subject row OR explicitly marked tutorOnly:true
  (this surfaces the 4 orphan tutors atlas/cadence/vigor/forge as failures until
  Sprint 1 resolves them).

Emit a markdown table (docs/quality/subject-tutor-ux-matrix.md, generated, do not
hand-edit) with F/P/H/O status per cell, and a JSON baseline
(docs/quality/subject-tutor-ux-baseline.json) so the script hard-fails on
regression (any cell dropping from F→P/H) exactly like
scripts/curriculum-coverage-check.mjs does. Document it in this file's section 1c.
```

---

### Sprint 1 — Fix catalog wiring + the entitlement/mapping defects ✅ landed

> Shipped: added `geography`/`music`/`physical-education`/`engineering` subject
> rows (the 4 orphan tutors are now reachable), `getDiscoverableSubjects()` as
> the single client-agnostic source, fixed `art_canvas→muse` and
> `voice_response→[echo,lingua]` entitlements (+ tests), seeded the 4 new
> subjects, and switched both web and mobile grids to the registry. Per the
> "no coming soon — all e2e" direction, every subject is reachable + playable
> end-to-end (generic activities now; bespoke surfaces in Sprints 4–10) rather
> than locked. `ux:matrix`: 0 hidden, 0 orphan.

```
Close the confirmed catalog defects (small, high-leverage):

1. Orphan tutors. In packages/brand/src/subjects.ts, decide and implement one of:
   (a) add LEARNER_SUBJECTS rows for geography (atlas), music (cadence),
       physical-education (vigor), and engineering (forge) with productionReady:false,
       OR (b) add an explicit `tutorOnly: true` discoverability path so these
       tutors are reachable from the tutor catalog without a subject card.
   Update getProductionReadySubjects()/getDiscoverableSubjects() accordingly and
   make `pnpm ux:matrix` (Sprint 0) pass with no O cells.

2. Entitlement map. In packages/learner-surfaces/src/entitlement/required-tutor.ts:
   - change art_canvas: "cadence" → "muse" (art_canvas belongs to the art tutor).
   - add a second voice surface owner so echo (speech) is entitled to
     voice_response, not just lingua (model it as a set or add a speech-specific
     surface). Add a unit test asserting each premium surface maps to its correct
     subject's tutor.

3. Unify subject visibility across clients. Replace the divergent logic
   (web filters to productionReady; mobile shows all brain domains) with ONE shared
   selector exported from @aivo/brand (e.g. getDiscoverableSubjects()) that returns
   productionReady subjects PLUS coming-soon subjects with a `locked` flag. Web
   (app/learner/subjects/page.tsx:43-47) and mobile
   (app/(learner)/subjects/index.tsx:25) both consume it and render an identical
   "Coming soon — content in progress" locked card for non-ready subjects instead
   of either hiding them (web) or routing into an empty session (mobile).

Add tests on both clients asserting the same set of subject cards + lock states.
```

---

### Sprint 2 — Web: wire the real 14-tutor catalog into the subject/lesson flow ✅ landed

> Shipped: replaced the hardcoded fictional personas in `lesson-plan.ts` with
> the canonical brand tutor resolved from the subject's `tutorKey` (the lesson
> eyebrow/greeting now show Sage/Nova/Spark/…), generalized
> `tutorForSubjectSlug` to derive a brand-backed descriptor for every subject,
> and added tests asserting no lesson renders a persona outside `TUTORS`. The
> fully-interactive in-lesson tutor chat panel remains a scoped follow-up.

```
Replace the hardcoded fictional personas with the canonical tutor catalog so the
web experience matches the brand and the mobile app.

In apps/web-v2:
- Delete TUTOR_PERSONA_BY_SUBJECT (lib/learner/lesson-plan.ts:22-24,245) and resolve
  the tutor for a lesson from the subject's tutorKey via @aivo/brand TUTORS
  (name, avatar, color, domain, voiceStyle). The lesson header, tutor badge, and
  read-aloud voice must reflect the real tutor (Nova/Sage/Spark/… not Nimbus/Zara).
- Generalise lib/learner/baseline-tutors.ts from its 6 hardcoded slugs to derive
  from LEARNER_SUBJECTS so every subject has a tutor mapping.
- Add an in-lesson tutor panel (mirror apps/mobile MobileTutorPanel): a persistent,
  subject-aware tutor presence during the lesson, wired to the tutor-svc session
  reply route with the correct tutorKey + subjectId (today /api/bff/.../tutor/reply
  passes subjectId:null and no tutorKey).

Acceptance: every reachable subject shows its real brand tutor end-to-end; a test
asserts no lesson renders a persona string outside TUTORS.
```

---

### Sprint 3 — Unify the activity-surface contract (stop web↔mobile drift) ✅ landed

> Shipped: `SURFACE_CAPABILITY_REGISTRY` in `@aivo/learner-surfaces` as the
> single source of truth for per-platform surface support (web 10/15 full,
> mobile 6/15 full), validated against the real web router; the `ux:matrix`
> gate now renders a surface-capability table from it. Added mobile surface
> telemetry (`apps/mobile/lib/surface-telemetry.ts`): the renderer emits
> `surface_started` for real surfaces and `unsupported_surface` for fallbacks
> (no more silent scratchpad downgrade) and shows a "simplified version" label;
> also synced the mobile `art_canvas→muse` entitlement. Tests cover the
> registry completeness and the telemetry helper.

```
Make mobile consume the same surface contract as web so activities can't silently
diverge again.

- Promote the LearnerSurfaceType union + per-surface spec/result types from
  packages/learner-surfaces/src/types.ts into a shared, RN-safe contract package
  (or have apps/mobile import the types directly). Map the mobile-only vocabulary
  (text_response, fraction_bar, chart) onto the canonical types or add them to the
  canonical union with an entry in surface-type-map.ts.
- Add a single SURFACE_CAPABILITY_REGISTRY (one source of truth) listing, per
  surface type, whether web and mobile have a real renderer vs. a fallback. Export
  it; the Sprint 0 gate reads it instead of guessing.
- For every surface type, both clients must EITHER render a real component OR a
  clearly-labelled "this activity isn't available on <device> yet — open on
  <other device>" fallback that emits an `unsupported_surface` telemetry event
  (web already does this in SurfaceHost; give mobile the same behavior instead of
  silently downgrading geometry/graph to a blank scratchpad).

Acceptance: a test enumerates LearnerSurfaceType and asserts both clients have a
registry entry; no surface silently degrades without telemetry.
```

---

### Sprint 4 — Reading & Writing experience (sage): the `reading_annotation` surface

```
Build the reading_annotation surface so ELA comprehension is a real activity, not
multiple-choice-on-a-wall-of-text.

- Implement ReadingAnnotationSurface in packages/learner-surfaces (passage with
  selectable spans, highlight/underline tools, inline comprehension prompts tied to
  spans, evidence-citation capture for the response). Follow the safe-rendering
  rule used by GeometrySurface (no arbitrary markup; spans addressed by index).
- Wire it into the web SurfaceRouter and add the mobile renderer per the Sprint 3
  registry (touch-based span selection).
- Add a writing-support variant for sage's writing subject (sentence/段落 organizer
  or revision checklist) OR file a follow-up if out of scope — but reading_annotation
  is the must-ship.

Acceptance: a sage reading lesson routes a reading_annotation beat on both clients;
the response captures highlighted evidence; scoring + telemetry flow through.
```

---

### Sprint 5 — Math experience (nova): manipulatives, graphing, multi-step

```
Close the math activity gaps so nova delivers more than text-entry + MCQ.

Implement and wire (web + mobile per Sprint 3 registry):
- drag_manipulative — base-ten blocks / counters / fraction bars / number tiles a
  learner can drag, snap, and group (early-grade math + executive-function reuse).
- graph — interactive coordinate plane: plot points, draw lines, read intercepts
  (replaces today's "hand-draw on a scratchpad" mobile fallback).
- multi_step_workspace — a structured multi-line solver that validates each step
  (not one final answer), so process telemetry is captured.

Upgrade math_expression beyond plain-text normalization to a proper expression
editor (fractions, exponents, radicals) shared by web + mobile.

Acceptance: a nova lesson can route each of these surfaces on both clients; the
Sprint 0 matrix flips nova→math toward F.
```

---

### Sprint 6 — Science experience (spark): the `science_diagram` surface

```
Build the science_diagram surface so science activities include labelling/structure,
not just MCQ + video.

- Implement ScienceDiagramSurface: an author-supplied diagram (deterministic SVG,
  same safe-rendering discipline as GeometrySurface) with labelled drop-targets the
  learner fills (e.g. label the cell, the water cycle, circuit parts), plus a simple
  data-table/observation capture variant for experiments.
- Wire web + mobile per the Sprint 3 registry.

Acceptance: a spark lesson routes a science_diagram beat on both clients with
scoring + telemetry; matrix moves spark→science toward F.
```

---

### Sprint 7 — Speech & World Languages (echo, lingua): voice end-to-end

```
Make spoken activities real on both clients — the highest-value SpEd/therapy gap.

- Web: confirm VoiceResponseSurface is routed for echo and lingua lessons; ensure
  the entitlement fix from Sprint 1 lets echo (speech) use it.
- Mobile: add a voice_response case to MobileSurfaceRenderer.tsx that consumes the
  already-implemented hooks/useSpeechInput.ts (record → ai-svc transcribe →
  speech-eval scoring). This hook is currently only used by the homework helper;
  reuse it in the stage/lesson runtime.
- Add the speech-specific affordances echo needs: target word/phoneme display,
  record/playback/retry, and (where available) articulation feedback; add a
  pronunciation-guide affordance for lingua vocabulary.

Acceptance: an echo speech lesson and a lingua language lesson both route
voice_response and capture a scored spoken response on web AND mobile.
```

---

### Sprint 8 — Creative & expressive subjects (muse art, cadence music)

```
Deliver bespoke creative tooling, not a blank canvas.

- muse / art_canvas: upgrade ArtCanvasSurface with a real art toolset (palettes,
  brush sizes, shapes, layers/undo) on web + mobile; ensure the Sprint 1
  entitlement fix routes it to muse.
- cadence / music: add a music surface (tap-to-place notes on a staff or a
  rhythm/beat sequencer with audio playback) so cadence has a subject activity at
  all. Decide and implement cadence's discoverability path from Sprint 1.

Acceptance: muse and cadence each route a domain-appropriate creative surface on
both clients with response capture + telemetry.
```

---

### Sprint 9 — Media + accessibility in the lesson runtime (all tutors)

```
Bring media and lesson-level accessibility to mobile, where they are absent.

- Mobile: implement video and audio surfaces (expo-av) with captions/VTT and
  transcript, matching the web LessonMedia behavior (play/pause/seek/complete
  telemetry).
- Both clients: surface the lesson-level accommodations in the stage/lesson runtime
  — read-aloud (TTS) control, extended-time indicator, and break cadence — driven
  by the learner's accessibility settings / functioning level. Today web has TTS
  but mobile only adjusts the sensory palette; neither consistently shows
  extended-time / break cadence.

Acceptance: a media-rich lesson plays with captions on mobile; a learner on a
modified assessment sees read-aloud + extended-time affordances on both clients.
```

---

### Sprint 10 — Expansion subjects sweep + parity truth-up

```
Bring the remaining subjects to a coherent baseline and make the parity docs honest.

- For chrono (social-studies), harmony (SEL), compass (life/executive-function),
  atlas, vigor, forge: ship at least one domain-appropriate micro-surface or
  structured activity (timeline/map for chrono; feelings/scenario picker for
  harmony; schedule/checklist for compass life-skills; map for atlas; etc.) and
  flip productionReady:true ONLY once both the curriculum gate
  (docs/quality/tutor-k12-coverage-gap-plan.md) AND the Sprint 0 ux:matrix cell
  are satisfied. Do not flip the flag on content alone.
- Add a dedicated mobile baseline runner (intro / why / readiness / subject
  multi-select) so Discovery baseline is not the generic stage runtime
  (MOB-LRN-004 in docs/mobile/parity-sprint-plan.md).
- Extend scripts/web-mobile-parity-check.mjs to include surface-type parity and
  subject visibility, and regenerate docs/mobile-parity.md so its summary reflects
  the surface gaps (it currently claims 100%).

Acceptance: `pnpm ux:matrix` shows no H/O cells and every reachable subject is at
least P with a domain-appropriate surface; mobile-parity.md reports surface parity
honestly.
```

---

## 3. Suggested ordering & ownership

| Wave               | Sprints    | Theme                                                             | Unblocks                         |
| ------------------ | ---------- | ----------------------------------------------------------------- | -------------------------------- |
| Foundation         | 0, 1, 2, 3 | Gate + catalog fixes + web tutor wiring + shared surface contract | everything below                 |
| Core academics     | 4, 5, 6    | sage / nova / spark get real subject activities                   | the 4 production subjects → Full |
| Therapy & language | 7          | echo / lingua voice (highest SpEd value)                          | speech & languages → playable    |
| Creative & media   | 8, 9       | muse / cadence + media/accessibility                              | expressive subjects + a11y       |
| Closeout           | 10         | expansion subjects + parity truth-up                              | full catalog coherence           |

**Gate to run after every sprint:** `pnpm ux:matrix` (Sprint 0) plus the existing
`pnpm tutor:parity`, `pnpm mobile:parity:md`, and `pnpm curriculum:coverage`.

---

## 4. Evidence index

- `packages/brand/src/subjects.ts` — `LEARNER_SUBJECTS`, `productionReady`, orphan-tutor confirmation.
- `packages/brand/src/index.ts:97-226` — `TUTORS` catalog (14).
- `packages/learner-surfaces/src/types.ts` — 15 declared surface types.
- `packages/learner-surfaces/src/SurfaceRouter/surface-type-map.ts` — 10 implemented (`SUPPORTED_RUNTIME_TYPES`).
- `packages/learner-surfaces/src/entitlement/required-tutor.ts:41-42` — `art_canvas→cadence` (bug), `voice_response→lingua` only.
- `apps/web-v2/app/learner/subjects/page.tsx:43-47` — web filters to productionReady (4 subjects).
- `apps/web-v2/lib/learner/lesson-plan.ts:22-24,245` — hardcoded personas, not brand tutors.
- `apps/web-v2/lib/learner/baseline-tutors.ts` — only 6 subject→tutor mappings.
- `apps/mobile/app/(learner)/subjects/index.tsx:25` — mobile uses brain domains, no productionReady gate.
- `apps/mobile/src/components/learning/MobileSurfaceRenderer.tsx` — no `voice_response` case.
- `apps/mobile/hooks/useSpeechInput.ts` — implemented; consumed only by `app/(learner)/homework/[sessionId].tsx`.
- `docs/mobile-parity.md` — route-level "100% parity" claim (no surface-type axis).
  </content>
  </invoke>
