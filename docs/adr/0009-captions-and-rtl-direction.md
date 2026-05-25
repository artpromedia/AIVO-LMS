# 0009 — Captions parity test + locale-aware RTL direction

- **Status:** Accepted
- **Date:** 2026-05-25
- **Related:** Sprint 8, completeness-audit gaps #11 (captions) and #14
  (RTL never tested)

## Context

Two distinct accessibility gaps surfaced in the completeness audit:

1. **Captions.** The audit reported "no WebVTT track support in
   `learner-surfaces` Video/Audio component." In fact, the
   `MediaSurface` component already renders `<track kind="captions">`
   for every `kind: "captions"` `SurfaceAssetDescriptor` and refuses
   to render media without captions. But there was no test pinning
   that contract — a regression that quietly dropped `<track>`
   rendering would have shipped silently.

2. **RTL.** `apps/web-v2/app/layout.tsx` hardcoded
   `dir={locale === "ar" ? "rtl" : "ltr"}` — a one-locale check that
   would not pick up `he`, `fa`, `ur`, or `ar-EG`. The marketing
   provider had a similar `if (newLocale === "ar")` branch that only
   set RTL on switch-to-ar, never reset to LTR on switch-from-ar to
   another locale, leaving a stale `dir="rtl"` attribute.

## Decision

We pin the existing captions behaviour with explicit tests and
centralise the RTL direction logic into the i18n config layer.

### Captions

- **`packages/learner-surfaces/src/Video/__tests__/captions.test.tsx`**
  (new, 5 tests) asserts:
  - `VideoSurface` renders one `<track kind="captions">` per caption
    asset, with the correct `src`, `srcLang`, `label` attributes;
  - the `default` flag survives serialisation;
  - a video with zero captions falls into the error branch ("Captions
    are required");
  - `AudioSurface` follows the same contract.

  Pure SSR (`renderToStaticMarkup`) — no jsdom needed.

### RTL direction

- **`apps/web-v2/lib/i18n/config.ts`** — new exports:
  - `RTL_LOCALES: ReadonlySet<string>` — `ar`, `he`, `fa`, `ur`, `ps`,
    `sd`, `yi`. Only `ar` ships today; the rest are future-proofing.
  - `isRTL(locale)` — strips BCP-47 region tags, lowercases, and
    checks the set. Accepts both the strict `Locale` union and raw
    strings (middleware / next-intl give us strings).
  - `dirForLocale(locale): "rtl" | "ltr"`.

- **`apps/web-v2/app/layout.tsx`** — `dir={dirForLocale(locale)}`
  replaces the hardcoded `=== "ar"` check.

- **`apps/marketing/src/i18n/config.ts`** — mirrors the same
  `RTL_LOCALES`, `isRTL`, `dirForLocale` helpers (marketing is a
  separate Next app with its own i18n; cross-app import would require
  a shared package and is not in scope).

- **`apps/marketing/src/providers/i18n-provider.tsx`** — both the
  `setLocale` callback and the `useEffect` now call `dirForLocale()`,
  so switching FROM `ar` TO another locale correctly resets `dir`
  to `ltr`. Previously the `useEffect` only ever set RTL, never LTR,
  leaving a stale attribute.

- **`apps/web-v2/lib/i18n/i18n-direction.test.ts`** (new, 8 tests) —
  pins every shipped locale's direction, BCP-47 region-tag stripping,
  case-insensitivity, the `RTL_LOCALES` set contents.

## Consequences

- **Positive:**
  - Captions cannot silently regress: the test asserts both the
    happy path (per-asset `<track>` element) and the failure path
    (error branch when captions are missing).
  - Adding a new RTL locale (e.g. Hebrew) is now a single-line edit
    in two `config.ts` files; layout / provider code doesn't change.
  - Marketing's switch-from-ar bug is closed — `dir` flips back to
    `ltr` correctly.
  - `accessibility:audit` continues to pass.
- **Negative:**
  - `RTL_LOCALES` is duplicated between `apps/web-v2/lib/i18n/config.ts`
    and `apps/marketing/src/i18n/config.ts`. Hoisting it to a shared
    workspace package is a follow-up.
  - The repo doesn't yet ship a `tailwindcss-rtl` plugin or a
    sweeping logical-property pass over learner pages (the Sprint 8
    prompt mentioned both). With `dir="rtl"` set, the browser
    auto-mirrors most flow content; the directional Tailwind utilities
    (`ml-*`, `pr-*`, `left-*`) still flow LTR. Visual RTL polish is a
    design-team task tracked separately.
  - Marketing's `<html lang="en">` is still hardcoded in the layout
    SSR path — the i18n-provider corrects it client-side, so there's
    a brief FOUC for `ar` cookie users on first paint. Fixing it
    needs `getLocale()` at the layout level; deferred.
- **Neutral / follow-ups:**
  - The captions tests run via `renderToStaticMarkup`. End-to-end
    playback assertions (caption track actually loads and renders)
    belong with a Playwright spec in the e2e-coverage sprint.
  - The directional Tailwind plugin would let class-level utilities
    auto-flip. Not blocking; Tailwind's `rtl:` variant can be added
    incrementally.

## Alternatives Considered

- **Move RTL logic into next-intl's request layer.** Considered:
  next-intl doesn't expose `dir` directly; we'd still need a helper.
  Keeping it in `config.ts` next to the locale list is the most
  obvious place for a reader to find it.
- **Render captions only on the `default` track.** Rejected: a
  learner might switch the caption language at runtime; every track
  needs to be present in the DOM so the `<select>` can toggle them
  via `textTracks[i].mode`.
- **Skip the captions test because the behaviour already worked.**
  Rejected: the audit explicitly flagged "no WebVTT support tested";
  if reviewers can't see a test, they assume the contract isn't
  pinned.
