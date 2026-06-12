# Sprint 03 — Web sensory end-to-end: the lesson player obeys the sensory system

## Goal

At the end of this sprint, a learner's sensory profile and sensory mode **visibly govern the web lesson experience**: calm/high-contrast modes and a parent-curated sensory profile (hyper/hypo per modality) change the lesson player's saturation, animation speed, transition durations, and concurrent-element budget — including the pixi.js brain-sphere canvas — and the `no-inert-prefs` CI gate proves the wiring can never silently regress. Today `useSensoryAdapter` computes 10 adaptations and exports `getCSSVars()` but has **zero consumers in web-v2** (verified), and the adapter's internal fetch targets a service path that doesn't exist on the web origin. Closes audit gap **B2 (web half, 🚨)** — "the most sensory-intense moment of the product is the least governed by the sensory system."

## Context

- **The adapter (engine):** `packages/stage-runtime/src/useSensoryAdapter.ts`
  - Lines 36-163: loads a five-modality sensory profile (visual/auditory/tactile/vestibular/proprioceptive, each hyper/typical/hypo) and derives adaptations: `colorSaturation` (70–120%), `animationSpeed` (0.5–1.0), `volumeLevel`, `maxOnScreenElements` (3–6), `useSubtitles`, `hapticIntensity`, `motionReduced`, `contrastBoost`, `boldOutlines`, `pulseAttention`, plus a regulation-break suggester.
  - Line 104: `fetch(\`/api/assessments/sensory-profile/${learnerId}\`)` — an assessment-svc path. On the web-v2 origin this 404s; web pages must not fetch service URLs directly (the app's pattern is BFF routes under `apps/web-v2/app/api/bff/**` or server-side repo reads).
  - Lines 127-135: `getCSSVars()` returns `--stage-saturation`, `--stage-animation-speed`, `--stage-transition-duration`, etc.
- **The profile data on web:** the parent curates it at `apps/web-v2/app/parent/learners/[learnerId]/sensory/page.tsx` ("Shows the learner's response (hyper / neutral / hypo) across five sensory modalities… Lessons are adapted in real time to match this profile" — copy that is currently a false promise). Locate that page's read/write path into `apps/web-v2/lib/db/repos.ts` (the brain-profile state carries a `sensory` field — see `repos.ts:266`) and reuse it; do not invent a second store.
- **The player:** `apps/web-v2/app/learner/lesson-runs/[lessonRunId]/page.tsx` (server: loads run + accessibility prefs, IDOR-guards) → renders `lesson-player.tsx` (client, 1,133 lines). Existing anchors: `SurfaceRouter` import at `lesson-player.tsx:37-39`; `AACTargetProvider` at `:42`; `BREAK_REMINDER_MS` const at `:273`, used at `:397`; accessibility wrapper attributes (`data-reduced-motion`, `data-large-text`, `data-dyslexia-font`, `data-high-contrast`) near the root render (search `data-reduced-motion`, ~line 870).
- **Sensory modes (already shipped, distinct from the profile):** standard/calm/high-contrast via `apps/web-v2/components/system/sensory-mode-provider.tsx`, SSR-stamped `data-sensory-mode` on `<html>`, with `--aivo-sensory-motionScale` 1/0.5/0 from `packages/brand/src/inclusive-warm.ts:304-362`. The player must compose **both**: mode (global) × profile (per learner).
- **Canvas:** `apps/web-v2/components/brain/pixi-brain-sphere.tsx` — pixi.js dynamically imported at `:198`; already degrades for `prefers-reduced-motion`; does **not** read sensory vars.
- **The guard to extend:** `scripts/a11y/no-inert-prefs.mjs` — CI gate (in `.github/workflows/accessibility.yml`) that fails when a collected preference has no consumer proof in a render path. Read its proof-token mechanism before touching it.
- **Voice settings (small adjacent fix):** the learner voice/speed page already exists and is wired (`apps/web-v2/app/learner/settings/audio/{page,form}.tsx` using `getLearnerVoicePreference`/`upsertLearnerVoicePreference`). The audit gap is discoverability: the accessibility form (`apps/web-v2/components/learner/accessibility-form.tsx`) exposes `readAloud` with no path to voice/speed.
- **e2e helpers:** per-surface player specs exist (`apps/web-v2/e2e/lesson-player-*.playwright.ts`) with shared helpers in `apps/web-v2/e2e/lesson-player-surfaces.helpers.ts` — reuse them to reach a playing lesson. Visual assertions pattern with anti-blank guard: `apps/web-v2/e2e/visual-a11y.playwright.ts:36-45`.

## Work orders

### DELETE
1. In `packages/stage-runtime/src/useSensoryAdapter.ts`: the hardcoded `fetch("/api/assessments/sensory-profile/…")` call (line ~104) as part of REFACTOR-1 — the hook must stop owning transport.

### CREATE
1. `apps/web-v2/app/api/bff/learners/[learnerId]/sensory/route.ts` — GET returning the learner's sensory profile from the same repo read the parent sensory page uses. Follow the BFF house pattern exactly (copy the guard stack from `apps/web-v2/app/api/bff/learners/[learnerId]/accessibility/route.ts`: `requireSession` → `requireRole(["parent","learner","teacher","school_admin"])` → `requireLearnerScope` → `requireLearnerConsent(["child_data_collection"])` → `ok()/fail()` envelope + `audit()` on access).
2. `packages/stage-runtime/src/derive-sensory-adaptations.ts` — **pure** function `deriveSensoryAdaptations(profile: SensoryProfile | null, opts?): SensoryAdaptations` extracted verbatim from the hook's derivation logic, plus `sensoryCSSVars(adaptations): Record<string,string>` (the `getCSSVars` body). Export both from the package index. Unit-testable with no DOM/fetch.
3. `packages/stage-runtime/src/derive-sensory-adaptations.test.ts` — table-driven tests: hyper-visual → saturation ≤ 0.85 & maxOnScreenElements ≤ 4; hypo-visual → saturation ≥ 1.0; vestibular-hyper → motionReduced true; null profile → neutral defaults; composition with `motionScale 0` → all durations 0.
4. `apps/web-v2/e2e/stage-sensory.playwright.ts` — `@a11y`-tagged spec using `lesson-player-surfaces.helpers.ts` to open a lesson, then:
   - sets the calm sensory-mode cookie (read how `sensory-mode-provider.tsx` persists it) and asserts the player root's computed `--stage-animation-speed` ≤ 0.5× the standard value;
   - seeds a hyper-visual profile through the new BFF (PATCH/PUT if you add one, else through the repo seed path the parent page uses) and asserts the root carries the derived `--stage-saturation`;
   - `toHaveScreenshot` per mode (standard/calm/high-contrast), reusing the anti-blank guard from `visual-a11y.playwright.ts`.

### REFACTOR
1. `packages/stage-runtime/src/useSensoryAdapter.ts` — becomes a thin composition: accepts `{ profile }` (or a `loadProfile: () => Promise<SensoryProfile|null>` injection) instead of fetching a hardcoded URL; delegates math to `deriveSensoryAdaptations`. Keep the public hook signature backward-compatible for any existing package-internal tests; update package exports.
2. `apps/web-v2/app/learner/lesson-runs/[lessonRunId]/page.tsx` — server-load the sensory profile (same repo read as CREATE-1; prefer the direct repo call server-side over HTTP-to-self) alongside the accessibility prefs it already loads, and pass it to `LessonPlayer` as a prop.
3. `apps/web-v2/app/learner/lesson-runs/[lessonRunId]/lesson-player.tsx` —
   - compute `adaptations = deriveSensoryAdaptations(profile, { motionScale: <from data-sensory-mode/css var>, functioningLevel })` and spread `sensoryCSSVars(adaptations)` as inline CSS-variable styles on the existing accessibility wrapper element (the one carrying `data-reduced-motion`, ~line 870) — CSS variables via `style` are the sanctioned exception to the no-inline-style norm (they're tokens, not colors; the ESLint hex ban is untouched);
   - make beat-transition durations and the celebration step read `--stage-transition-duration`/`--stage-animation-speed` (today they use fixed Tailwind transitions — route the durations through the vars);
   - cap simultaneously rendered choice items / decorations by `maxOnScreenElements` where the beat layout allows (at minimum: pass it into `SurfaceRouter` as a prop if the surface supports density, else apply to the player's own decorative elements);
   - when `adaptations.motionReduced || prefers-reduced-motion || mode==="high-contrast"`, hard-zero the vars (parity with `globals.css:185-191`).

### EDIT
1. `apps/web-v2/components/brain/pixi-brain-sphere.tsx` — read `--stage-animation-speed` (fall back to `--aivo-sensory-motionScale`) from the host element and multiply the pixi ticker/rotation speed by it; at `0`, render the existing static CSS fallback path instead of animating.
2. `scripts/a11y/no-inert-prefs.mjs` — add consumer-proof entries so the gate fails if `deriveSensoryAdaptations`/`sensoryCSSVars` lose their lesson-player consumer (follow the script's existing token format exactly).
3. `apps/web-v2/components/learner/accessibility-form.tsx` — add a link row "Voice & speed" → `/learner/settings/audio` inside the audio/reading group (new i18n key in all 10 catalogs).
4. `apps/web-v2/app/parent/learners/[learnerId]/sensory/page.tsx` — no behavior change; verify its description copy ("Lessons are adapted in real time…") is now true; if the page exposes no hint of *where* adaptation shows up, add one sentence linking to the lesson experience (i18n keys, all catalogs).

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## Definition of done

1. Manual run (`corepack pnpm --filter @aivo/web-v2 dev`, learner mock session): open a lesson run; switch sensory mode standard → calm in the header → transitions visibly slow and saturation drops **without reload**; high-contrast → no non-essential motion at all (verify the brain sphere is static).
2. As parent, set the learner's visual modality to "hyper" on `/parent/learners/<id>/sensory`; as learner, reopen the lesson → fewer simultaneous decorative elements + reduced saturation (inspect the computed `--stage-*` vars in devtools and screenshot).
3. Commands green:
   - `corepack pnpm --filter @aivo/stage-runtime test` (new pure-function tests)
   - `corepack pnpm --filter @aivo/web-v2 typecheck && corepack pnpm --filter @aivo/web-v2 lint && corepack pnpm --filter @aivo/web-v2 test`
   - `corepack pnpm --filter @aivo/web-v2 exec playwright test stage-sensory lesson-player` (new spec + all existing `lesson-player-*` suites stay green)
   - `pnpm run a11y:no-inert-prefs` (extended gate passes; then prove the negative: comment out the player's var application locally → gate fails → restore)
4. No raw hex introduced anywhere (ESLint gate green).

## Tests

- New: `derive-sensory-adaptations.test.ts` (package), `stage-sensory.playwright.ts` (e2e, `@a11y`-tagged so Sprint 02's CI lane picks it up automatically).
- Update: any existing `stage-runtime` tests touching `useSensoryAdapter`'s old fetch behavior.
- Run full web-v2 unit suite + all `lesson-player-*` e2e specs; previously green stays green.

## Out of scope

- Mobile stage (Sprint 04). Lesson-player file decomposition (Sprint 12 — keep this sprint's edits surgical; do not restructure the file). Per-tutor theming (Sprint 15). TTS/audio playback changes. The baseline runner (`/learner/baseline/[baselineId]`) — note in the checkpoint if it shares the wrapper and would inherit the vars for free, but do not modify it.

## Depends on

Sprint 02 recommended first (so the new `@a11y` spec runs in the CI lane), but not a hard dependency.

## Checkpoint

Summarize: the adaptation data path (parent page → repo → server page → player vars → canvas) with file:line for each hop, DoD outputs including the negative-proof of the `no-inert-prefs` gate, and before/after screenshots per sensory mode. **Pause for owner review. Do not commit, stage, or push unless explicitly instructed.**
