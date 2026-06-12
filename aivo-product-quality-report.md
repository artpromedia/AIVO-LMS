# AIVO-LMS Enterprise Product Quality Audit — Web, Mobile & Admin

**Date:** 2026-06-12 · **Mode:** Read-only · **Lens:** Senior product engineer, enterprise craft bar
**Scope:** `apps/web-v2` (learner/parent/teacher web), `apps/mobile` (Expo), `apps/web-admin` (+ shared packages)
**Calibration:** Learner → Duolingo/Khan Kids · Parent/teacher → Linear/Notion · Admin → Stripe Dashboard
**Scale:** 1 = prototype · 3 = acceptable enterprise baseline · 5 = best-in-class

## Method & evidence confidence

- **Static review** of all three surfaces plus `packages/{brand,ui,learner-ui,admin-ui,mobile-ui,stage-ui,stage-runtime,learner-surfaces,accessibility-contract,aac-bridge,sso,security,audit-client,db}` via seven parallel deep-dive investigations, followed by a **manual verification pass** on every load-bearing or disputed claim.
- **Live run:** `web-v2` was booted in dev with `AUTH_MODE=mock` and exercised via Playwright across 16 routes for all three in-app audiences (landing, auth, parent ×6, learner ×6, teacher). Screenshot evidence is referenced as `[shot: name]`.
- **Not run live:** `web-admin` (auth hard-requires identity-svc RS256 JWTs + Postgres; Docker daemon unavailable in this environment) and `apps/mobile` (native fidelity requires device/simulator). Both are assessed from code only; claims about their *rendered* feel are marked accordingly.
- **Important meta-finding:** the repo's own audit docs (`docs/ux/UX-00-audit.md`, `docs/ux/UX-14-…`, `docs/accessibility/NEURODIVERSE-LEARNER-REMEDIATION-PLAYBOOK.md`, `docs/accessibility/vpat-readiness.md`, all stamped 2026-05-17) are **3–4 weeks stale and materially wrong about today's code** — real auth, web recovery routes, skip link, dyslexia fonts, break reminders, and the AAC schema fix all shipped after they were written. Several claims below exist specifically to correct that record. ❓ Unverified items are explicitly marked.

---

## 1. Executive summary

| Surface | Verdict | One-line summary |
|---|---|---|
| **Learner/parent web (`web-v2`)** | **Approaching enterprise-grade** | Parent/teacher views are at or near the Linear bar; learner surfaces have best-in-class *bones* (copy, calm, accessibility plumbing) but under-deliver delight and still read "dashboard-first" for a child. |
| **Mobile (`apps/mobile`)** | **Approaching** | Unusually strong resilience engineering (offline outbox, crash snapshots, lint-enforced a11y props), but visual polish (skeletons, dark/sensory parity, dyslexia font) and core-lesson reduced-motion lag the web. |
| **Admin (`web-admin`)** | **Approaching (high floor, narrow ceiling)** | Remarkably honest — 84 pages, zero mock data, hash-chained audit log with export+verify — but missing the Stripe-tier ergonomics: bulk actions, confirmations/undo, command palette, date ranges, search on most tables. |

**The three things that most undermine enterprise perception today**

1. **A flagship screen greets parents with a phantom child.** `/parent/home-v2` hardcodes `learnerFirstName = "Emma"` (`apps/web-v2/app/parent/home-v2/page.tsx:41-42`) while the signed-in demo parent's actual learners are Sky and Rio. The route is reachable (linked from `app/parent/learners/[learnerId]/snapshot/page.tsx`) and is visually the *best* parent screen in the product — which makes the fake data worse, not better [shot: 11-parent-home-v2]. For a product whose currency is parental trust, one phantom learner outweighs ten polished screens.
2. **The neurodiverse promise stops at the door of the core lesson surfaces.** The platform has a real `AccessibilityPreferences` contract, a sensory-profile adapter that derives 10 runtime adaptations (`packages/stage-runtime/src/useSensoryAdapter.ts:36-163`), and per-functioning-level motion budgets (`packages/learner-ui/src/tokens/motion.ts:15-71`) — yet the adapter's CSS vars have no consumer in the lesson player or learner-surfaces, and the mobile stage runtime (`apps/mobile/src/components/learning/MobileStageRuntime.tsx`) contains no `reduceMotion` check at all (verified by grep). The most sensory-intense moment of the product is the least governed by the sensory system.
3. **Quality gates don't cover what the product claims to be best at.** Eight axe-powered `@a11y` Playwright suites exist (`apps/web-v2/e2e/*-a11y.playwright.ts`, using `injectAxe`/`checkA11y` — e.g. `audit-a11y.playwright.ts:7,26-27`) but **no CI workflow runs them** (verified: no `test:a11y`/axe reference in `.github/workflows/ci.yml` or `learner-pr-check.yml`; `accessibility.yml:53-82` runs static contract gates only). Likewise, route-level resilience is thin: 138 pages but only 6 `loading.tsx`, 8 `error.tsx`, 5 `not-found.tsx` (verified counts), and admin destructive actions (token revoke, control delete, disable) are one-click with **zero confirmation dialogs** anywhere in `web-admin`/`admin-ui` (verified grep).

**What genuinely impressed (worth saying out loud):** the token architecture with an ESLint hex ban that holds at 0 violations across apps (`eslint.config.mjs:79-115`); sensory modes (Standard/Calm/High-Contrast) SSR-stamped on `<html>` with cross-tab sync (`apps/web-v2/components/system/sensory-mode-provider.tsx`); the Calm Corner ("There is no timer pressure and nothing is graded" [shot: 25-learner-calm]); the accessibility settings page framing ("Every option is built into the calm AIVO experience, never a separate mode" [shot: 24-learner-a11y-settings]); identity (SAML JIT with cross-tenant defense, TOTP/WebAuthn/recovery codes, Argon2id, HIBP k-anonymity — `packages/sso/src/index.ts`, `packages/security/src/password-policy.ts:130-154`); and the admin's hash-chained, exportable, *re-verifiable* audit log (`apps/web-admin/app/district/audit/export/page.tsx`, verify-upload flow).

---

## 2. Scorecard matrix

Scores are per surface; "web" = web-v2 (learner+parent+teacher).

| Dimension | Web | Mobile | Admin | One-line justification |
|---|---|---|---|---|
| **A. Design system & visual consistency** | **4** | **3.5** | **3.5** | One token source (`packages/brand`) with CI enforcement and 0 hardcoded hex in app code; docked for two parallel learner Button APIs, web display font (Satoshi) diverging from the brand's stated Fredoka while mobile uses Fredoka, mobile lacking the web's sensory-mode trio, and admin keeping a second palette outside brand tokens. |
| **B. UX & interaction quality** | **3.5** | **3.5** | **3** | Web: superb error/empty copy where it exists, but 6/138 routes have `loading.tsx`, exactly 1 `<Suspense>`, no toast/optimistic layer. Mobile: offline banner + queue + pull-to-refresh, but `ActivityIndicator` instead of skeletons. Admin: graceful per-panel degradation, but full-page-reload "Retry", URL-param error strings, no confirmations. |
| **C. Accessibility & neurodiverse-first** *(weighted heaviest)* | **4** | **3** | **2.5** | Web: skip link, `:focus-visible` tokens, bundled dyslexia fonts, AAC schema fixed, break reminders, high-contrast SSR — genuinely strong; axe not gated in CI. Mobile: lint-error-enforced a11y props (build gate) but no dyslexia font, no reduced-motion in stage runtime, sparse live announcements (3 call sites). Admin: good table semantics (`aria-sort`, `aria-current`), otherwise unaudited surface with no axe coverage. |
| **D. Audience fit** | **3.5 learner / 4 parent·teacher** | **3.5** | **4** | Learner web copy is shame-free and age-right, but the home is a six-card "0%" dashboard, rewards are text-only, tutors are emoji chips — marketing has richer tutor art than the product. Parent home answers "what now?"; teacher home leads with "1 learner needs a nudge today" [shot: 30-teacher-home]. Admin fits internal-operator workflows well. |
| **E. Enterprise platform readiness** | **4.5** | **4** | **4.5** | SAML/OIDC/MFA/WebAuthn implemented (not scaffolded), RBAC matrix, tenant-scoped queries, hash-chained audit + WORM S3, DSAR lifecycle with SLAs, COPPA-scrubbed Sentry, 10 locales on every surface. Docked for: no Postgres RLS backstop, selective audit coverage, no product analytics (possibly intentional), RTL only partially exercised. |
| **F. Frontend engineering craft** | **3.5** | **3** | **3.5** | Strict TS everywhere; real CI gates (lint max-warnings=0, bundle budgets, Lighthouse budgets); pixi.js correctly code-split. Docked for: web's 128 ad-hoc `fetch(` sites with react-query installed-but-unused, 1,100+ line god components on web and a 1,578-line renderer on mobile, 63 `any`-escapes on mobile, 7 test files for admin's 84 pages. |

---

## 3. Detailed findings

### A. Design system & visual consistency — strong core, frayed edges

**Strong**
- Single source of truth: `packages/brand` merges 8 token JSON sources into CSS vars, JSON, TS, and a Tailwind preset (`packages/brand/scripts/build-tokens.mjs`), with semantic color/radius/space/type/motion layers (`packages/brand/src/tokens.ts:40-209`). Primary `#7C3AED` is consistent across web, admin, and mobile (`packages/mobile-ui/src/theme.ts`).
- **Enforcement, not aspiration:** ESLint bans hex literals in `apps/web-v2`/`apps/marketing` via three AST selectors with a token-pointing error message (`eslint.config.mjs:79-115`), and CI builds + verifies token artifacts (`.github/workflows/design-language.yml:58-79`, `apps/web-v2/scripts/check-brand-tokens.mjs`). Measured result: 0 hex violations in app TSX across all three surfaces.
- Three-tier theming few products attempt: sensory modes (standard/calm/high-contrast, with `motionScale` 1 → 0.5 → 0, `packages/brand/src/inclusive-warm.ts:304-362`), age modes (sprout/spark/scholar touch-target & type scaling, `packages/brand/src/playful-calm.ts`), and functioning-level motion budgets down to "PRE_SYMBOLIC: all motion disabled" (`packages/learner-ui/src/tokens/motion.ts:15-71`).

**Weak**
- **Typography splits across surfaces.** Brand tokens declare Fredoka/Nunito for friendly surfaces (`packages/brand/src/tokens.ts:143-149`); mobile follows (Fredoka/Nunito, `apps/mobile/constants/typography.ts`), but web-v2 ships Satoshi as its display face (`apps/web-v2/app/layout.tsx:18-48`, `public/fonts/satoshi-*.woff2`). A parent moving between web and the app sees two different brand voices.
- **Two learner Button implementations** with different prop APIs and styling strategies coexist: `packages/learner-ui/src/primitives/Button.tsx` vs `packages/learner-ui/src/playful-calm/primitives.tsx` — undocumented which is canonical (`docs/design-language/components.md` is 4 lines).
- **Mobile lacks the web sensory-mode system.** Mobile has its own `SensoryModeProvider`/`useSensoryPalette` (99 files reference it — verified) with calm/focus/standard palettes, but it is a *parallel* model: no high-contrast mode, `userInterfaceStyle: "light"` pinned in `app.json`, no dark mode. Same product promise, two divergent mechanisms.
- **Admin maintains a second palette outside brand:** `--admin-chart-1..5` hardcoded in `apps/web-admin/app/globals.css:6-19`, plus a one-off `bg-[#0d2748]` login sidebar (`app/login/page.tsx:89`). Intentional separation, but now two color sources of truth.
- **Brand assets don't reach the product.** Three mascots × six expressions live in `packages/brand/assets/mascots/`, yet app-surface usage is a single mobile tutor panel (`apps/mobile/src/components/learning/MobileTutorPanel.tsx` — verified grep across both apps). Tutor avatar PNGs referenced by `TUTORS[*].avatar = "/images/tutors/*.png"` (`packages/brand/src/index.ts:92+`) exist **only** under `apps/marketing/public/images/tutors/` — web-v2 has no such directory and renders emoji instead (`apps/web-v2/app/learner/home/page.tsx:484,491,502`). The marketing site literally shows richer product art than the product.

**Best-in-class would look like:** one typographic voice per audience across web+mobile; a single Button per audience tier with the other deprecated in-code; mascots/tutor art as a first-class component (`<TutorAvatar>`), not marketing-only assets; admin palette exported from `@aivo/brand` as `ADMIN_CHART_PALETTE`.

### B. UX & interaction quality — excellent copy, thin state scaffolding

**Strong**
- Error states that exist are *written* beautifully: root `error.tsx` detects stale-server-action deploys and auto-reloads once with a sessionStorage guard before showing UI (`apps/web-v2/app/error.tsx:21-93`); learner error: "Your progress is saved. Tap 'Try again' to come right back" (`apps/web-v2/app/learner/error.tsx`); parent home-v2 error offers a legacy-home fallback (`app/parent/home-v2/error.tsx:15-54`).
- The flagship loading state is real skeleton work that preserves final layout (hero + setup track + 6-card grid) to avoid CLS (`app/parent/home-v2/loading.tsx:10-64`).
- Forms: server actions + Zod on the server (`app/onboarding/learner/new/actions.ts`), disabled-while-submitting with label swap ("Continue" → "Saving", `app/onboarding/parent-setup/page.tsx:94-106`), inline `role="alert"` errors.
- Admin degrades per panel: 8 parallel reads via `Promise.allSettled`, each failure rendering a `PanelError` skeleton + retry while the other 7 panels stay live (`apps/web-admin/app/platform/page.tsx:48-75`, `components/dashboard-panels.tsx:11-38`).
- Mobile: pull-to-refresh on dashboards, an offline banner with live-region announcements ("You're back online. Your work has been saved." — `apps/mobile/hooks/useOffline.ts:26-29`), and a crash-snapshot that re-queues a lesson-end payload if the stage crashes mid-render (`apps/mobile/app/(learner)/stage/[sessionId].tsx:62-67`).

**Weak**
- **Coverage, not quality, is the problem.** Verified counts for web-v2: 138 `page.tsx` vs 6 `loading.tsx`, 8 `error.tsx`, 5 `not-found.tsx`, 1 `<Suspense>`. Most routes fall back to ancestors' generic two-bar skeletons (`app/parent/loading.tsx` is 10 lines) or the root boundary.
- **No feedback layer.** Zero toast usage in web-v2 (verified grep: no `useToast`/`<Toaster`/`toast(` in `app/` or `components/`) despite `@radix-ui/react-toast` shipping in `package.json` (dead dependency). Async feedback is full-page redirect + banner; admin encodes errors into URL query params (`/platform/security/controls?error=…`, `app/platform/security/controls/page.tsx:30-33`) — functional, but Stripe-tier admins expect non-navigating feedback with retained form state.
- **Signup uses a disabled-until-valid submit with no inline field errors** (`apps/web-v2/app/signup/page.tsx:48,120`): a user with an invalid email sees a dead button and must guess why — an anti-pattern for exactly this product's audience. (Login, by contrast, maps every failure to a translated message — `app/login/page.tsx:135-157`.)
- Parent 404 has good copy and recovery CTAs but renders **without parent chrome** — bare white page, no sidebar [shot: 15-parent-404] — the exact gap the internal audit called out (UX-00 §4) remains.
- Mobile renders `ActivityIndicator`s, not skeletons; several screens blank during first load (mobile audit; consistent with `LoadingState` component design).
- ❓ Unverified: real-device scroll performance, keyboard-avoidance feel, and toast timing can't be judged without running on hardware.

**Best-in-class would look like:** every data route shipping a layout-preserving skeleton (template per role shell); a single `useAction()`/mutation layer giving optimistic updates + aria-live announcements + toasts; signup validating per-field on blur with the submit always enabled.

### C. Accessibility & neurodiverse-first design — real infrastructure, last-mile gaps (heaviest weight)

**Strong — and verified against stale internal docs**
- `packages/accessibility-contract` is a genuine contract: 17 bounded preference fields, strict Zod schemas, roundtrip tests, zero-dep entry (`src/index.ts:82-149`, `src/schema.ts:21-48`), consumed by web BFF and mobile.
- **The two "P0" gaps the internal playbook still lists are fixed in code:** (1) the accessibility PATCH route now derives its schema from the canonical contract *including* `aacEnabled/aacInputMethod/aacScanDelayMs` (`apps/web-v2/app/api/bff/learners/[learnerId]/accessibility/route.ts:8,20-24` — the comment even documents the old bug: "Includes the AAC fields, which the previous hand-rolled schema omitted (breaking every save)"; fields verified at `packages/accessibility-contract/src/schema.ts:36-38`); (2) dyslexia typefaces are bundled and wired — `public/fonts/AtkinsonHyperlegible-{Regular,Bold}.woff2` + `OpenDyslexic-Regular.otf`, `@font-face` via `app/fonts-dyslexia.css` imported at `globals.css:7`, activated by `[data-typeface="dyslexia"]` (`globals.css:173-176`).
- Skip link shipped (`globals.css:70-82`, rendered via `components/layout/app-shell.tsx` — verified), global `:focus-visible` token (`globals.css:64-68`), reduced-motion kill-switch honoring both the OS query and the per-learner attribute (`globals.css:185-191`).
- Break reminders are live in the lesson player: interval-driven gentle routing into the break screen, cleared on unmount (`app/learner/lesson-runs/[lessonRunId]/lesson-player.tsx:393-399`), plus a manual "Take a break" per beat. Mobile mounts a persistent `BreakReminder` in the learner layout (`apps/mobile/app/(learner)/_layout.tsx` — verified, correcting a subagent claim).
- AAC bridge is unusually deep: switch-scan (1/2/3-switch), dwell, eye-gaze calibration pipeline, OBF/OBZ import/export, PRC-Saltillo/Tobii/AssistiveWare adapters (`packages/aac-bridge/src/`), mounted by the lesson player when `aacEnabled` (`lesson-player.tsx:902-906`); mobile has its own `SwitchScanOverlay` with focus announcements (`src/components/SwitchScanOverlay.tsx:78`).
- Mobile a11y props are a **build-breaking lint gate**: `eslint-plugin-react-native-a11y` rules at error severity with a 4-file allowlist (`apps/mobile/eslint.config.mjs:57-97`); ~592 `accessibilityLabel` occurrences measured across the app.
- Emotional-safety copy discipline is observable, not aspirational: "No grades — this helps AIVO learn" [shot: 21-learner-baseline]; "There is no timer pressure and nothing is graded" [shot: 25-learner-calm].

**Weak**
- **The sensory adapter is an engine not connected to the wheels.** `useSensoryAdapter` computes saturation/animation-speed/volume/max-elements and exports `getCSSVars()` (`packages/stage-runtime/src/useSensoryAdapter.ts:127-135`), but no consumer was found in `learner-surfaces` or the lesson player; pixi-canvas experiences don't read it. On mobile, `useReducedMotion` exists and gates the splash and calm tools (`components/SplashGate.tsx`, `src/components/learner/calm/BoxBreathing.tsx`, `PatternFocus.tsx`) but **not** `MobileStageRuntime`/`MobileBeatRenderer` (verified zero matches) — the core lesson is the one place it's missing.
- **CI doesn't run the axe suites.** `accessibility.yml` gates are static (declaration audit, `no-inert-prefs` consumer-proof — a genuinely clever gate, `scripts/a11y/no-inert-prefs.mjs`), but the 8 `*-a11y.playwright.ts` axe specs are absent from `ci.yml`/`learner-pr-check.yml`. No automated contrast regression anywhere.
- Mobile parity gaps: no dyslexia-font option (hardcoded Fredoka/Nunito, `apps/mobile/constants/typography.ts`), only 3 `announceForAccessibility` call sites (answer feedback/saves are silent to TalkBack), `has-accessibility-hint` rule off.
- Web voice settings exist as data (6 TTS voices, speed clamps) but the learner-facing form exposes only a `readAloud` boolean; voice/speed selection lives on the parent audio page, not where the learner is (`components/learner/accessibility-form.tsx`).
- Admin surface a11y is essentially unmeasured beyond table semantics; dense forms lack `aria-describedby` error association (admin errors are page-level paragraphs).
- ❓ Unverified: actual contrast ratios of every theme variant (no tooling; manual checks only), real screen-reader behavior on device (the repo's own `docs/accessibility/mobile-screenreader-checklist.md` prescribes manual passes; last recorded 2026-06-11).

**Best-in-class would look like:** the sensory adapter's CSS vars consumed by every surface (stage included) with a Storybook/axe matrix across {3 sensory modes × 3 age modes × 5 functioning levels}; axe suites as a blocking PR lane; mobile lesson runtime honoring `useReducedMotion` and announcing answer feedback; dyslexia font on mobile via `expo-font`.

### D. Audience fit

**Learner (web): 3.5 — calm, kind, but not yet magical.**
The product's words are world-class for this audience; its visuals are a B2B dashboard wearing pastels. Evidence: learner home leads with a proper single CTA card ("Let's get you set up → Finish the baseline") but then presents an AI-tutors row + six subject cards all reading "Not started · 0% · Pick where to start" — abstraction (percentages) and choice-overload for a child [shot: learner-home, `screenshots/design-language/learner-home-after.png`]; Rewards is a text-only sticker book ("0/1 collected") with no sticker art, no mascot, no celebration imagery [shot: 23-learner-rewards]; tutor identity in-app is an emoji chip while real avatar art ships only on marketing (§A). The Discovery Adventure entry, by contrast, *is* the bar: warm second-person copy, trust chips, the purple brain orb as identity [shot: 21-learner-baseline]. The internal "no dashboard-first learner experience" rule (UX-00 §1.2) is still violated in spirit.
**Per-tutor surfaces:** the 14 *response surfaces* are genuinely distinct interaction models — ChoiceGrid, MathExpression, Geometry, Graph, ReadingAnnotation, CodingSandbox, Scratchpad, MultiStepWorkspace, DragManipulative, MusicSequencer, NumberLine, ArtCanvas (ink strokes + PNG/SVG export), ScienceDiagram, VoiceResponse (`packages/learner-surfaces/src/surfaces/` — distinct state machines and payloads, not reskins). But the 14 *tutors* are differentiated only by name/emoji/color/system-prompt; inside a lesson the chrome is tutor-agnostic (no `TUTORS` reference in `app/learner/lesson-runs/` — verified). "Nova's world" and "Sage's world" look the same.

**Parent/teacher (web): 4 — close to the Linear bar.**
Parent home states facts and next actions ("Your learners are set up. Pick one to dive in", "Needs your action: 1") [shot: 10-parent-home]; the fridge-ready summary page renders top-3 strengths / top-3 needs-work in plain language (`app/parent/learners/[learnerId]/summary/page.tsx:26-100`); consent is bucketized with revocation (`app/onboarding/consent/page.tsx:65-202`); teacher home leads with triage ("1 learner needs a nudge today… Open the needs support list") [shot: 30-teacher-home]. Two trust risks: phantom-Emma (§1.1), and clinical/internal jargon leaking to parents — a "Review brain clone" button sits on the parent roster card [shot: 10-parent-home]; "Brain clone" is an architecture name, not a parent word.

**Mobile: 3.5.** Full journey parity (baseline, stage, homework w/ speech+camera, billing, GDPR flows), learner PIN login from a cached family roster, biometric unlock with a correct invalid-token fallback (`app/(auth)/login.tsx:49-96`). Role switching exists (`(auth)/session-switch.tsx`, ADR 0020) — the internal audit's "five siloed apps, no switcher" finding is stale — but the five route-group architecture still means five parallel shells to maintain.

**Admin: 4.** Operator-shaped flows (DSAR queue with SLA states, SCIM token lifecycle with show-once plaintext, rostering CSV import with validate→run→job tracking — `apps/web-admin/app/district/sis/scim-section.tsx`, `admin-api/src/rostering.ts`). Fit gaps are ergonomic, not conceptual (§ below).

### E. Enterprise platform readiness — the strongest dimension

**Verified-real (not scaffolding):** SAML 2.0 SP with metadata/ACS, signed-assertion requirements, AES-256-GCM-encrypted IdP certs, JIT provisioning with cross-tenant email-collision rejection and a defense-in-depth rule preventing IdP-asserted `PLATFORM_ADMIN` outside the platform tenant (`packages/sso/src/index.ts:62-105,174-205`; `services/identity-svc/src/routes/sso.ts:219-283`). OIDC provider with PKCE-S256 and rotating RS256 keys (`services/identity-svc/src/routes/oidc-provider.ts`). MFA: TOTP (encrypted secrets), email OTP with lockout, WebAuthn passkeys, Argon2id recovery codes (`services/identity-svc/src/routes/auth.ts:54-58`, `packages/security/src/mfa-crypto.ts:117-132`). Password policy: 14-char minimum for internal roles, HIBP k-anonymity breach check failing open, 5-password history (`packages/security/src/password-policy.ts`). AMR/ACR claims per NIST 800-63B (`services/identity-svc/src/lib/jwt.ts:14-32`).

**RBAC:** 18 roles with a permission matrix (`packages/security/src/permissions.ts:3-126`); admin app re-derives a per-role permission table and guards every route through middleware (cookie-role gate + optional IP allowlist + CSRF same-origin, `apps/web-admin/middleware.ts:61-93`) and per-page `requirePageRole`/`requirePagePermission` (`packages/admin-auth/src/server.ts:101-137`). Multi-role via `availableRoles` claim + active-role header validation.

**Tenancy:** `tenant_id` FKs on core tables (`packages/db/src/schema/users.ts`, `learners.ts`), app-layer scoping verified in sampled queries; **no Postgres RLS backstop** — a single forgotten `WHERE` is the failure mode; the repo's own risk register agrees (UX-00 §7 "spot-check is overdue").

**Audit:** append-only hash chain (`services/audit-svc/src/lib/hashChain.ts`) with WORM S3 archival job, surfaced in admin with search/sort/CSV+JSONL export and **user-side integrity re-verification** (`district/audit/export` upload-to-verify) — beyond what most enterprise dashboards offer. Coverage is selective (high-value events; learner-facing mutations mostly unaudited).

**Compliance:** consent ledger (append-only, per-bucket, revocation timestamps — `services/identity-svc/src/routes/consent.ts`, `packages/db/src/schema/data-governance.ts:158-182`); DSAR lifecycle (6 request types, SLA clocks per regulation: GDPR 30d/CCPA 45d/FERPA 20d — `services/data-governance-svc/src/domain/sla.ts`); retention policies with legal hold; parent data export builder fan-out; PII redaction at two layers (pino `safe-logger` + Sentry `beforeSend` COPPA scrubber with hashed user ids, `packages/observability/src/sentry-scrub.ts:24-163`). The footer "COPPA · FERPA · SOC 2" claim is at least *engineering-substantiated* for the first two; ❓ SOC 2 attestation status is unverifiable from the repo.

**Observability:** Sentry on all three apps with mandatory scrubber; OTel fastify plugin with tenant baggage on every service; status-page-svc aggregating health. **No product analytics SDK anywhere** (verified) — defensible under COPPA, but it means *nobody can quantify* learner funnel drop-off; if intentional, it deserves an ADR.

**i18n:** 10 locales on web (verified `lib/i18n/messages/`: ar de en es fr hi ja ko pt zh) and mobile (i18next, ~1,700 `t()` calls, `I18nManager.forceRTL` sync for Arabic — `apps/mobile/lib/i18n.ts:63-84`); i18n parity is a CI gate (`ci.yml` i18n-and-completeness job). **Admin is English-only** — acceptable for internal tools, a blocker for district self-serve in non-English districts. ❓ RTL rendering quality unverified visually.

**Mobile offline:** AsyncStorage-persisted outbox with idempotency keys, 7-day TTL, session-priority replay lane, single silent-refresh auth retry, Maestro journey covering login→lesson→offline→sync (`apps/mobile/lib/offline-queue.ts`, `.maestro/journeys/login-lesson-offline.yaml`). Mutations-only: lesson *content* is not cached for offline play, and conflict policy is implicit server-wins.

### F. Frontend engineering craft

**Strong:** strict TS across all tsconfigs (`tsconfig.base.json:7`); web-v2/admin near-zero `any` (2/0 measured; mobile is the outlier at ~36 `: any` + 27 `as any`); CI blocks on lint (max-warnings=0), typecheck, unit, i18n parity, **bundle budgets** (`scripts/ci/bundle-budgets.json`, `ci.yml:267-313`) and **Lighthouse budgets** (LCP ≤2.5s, CLS ≤0.1, TBT ≤300ms, a11y ≥95 — `lighthouserc.web-v2.json`); pixi.js dynamically imported with CSS fallback and reduced-motion degradation (`components/brain/pixi-brain-sphere.tsx:198`); fonts self-hosted/variable/swap (`app/layout.tsx:18-57`); 23 e2e specs in `apps/web-v2/e2e/` including per-surface lesson-player suites and a **visual-regression spec that rejects near-uniform screenshots** (`e2e/visual-a11y.playwright.ts:36-45` — built after the team discovered committed blank screenshots, `docs/design-language/README.md:24-31`; admirable honesty).

**Weak:**
- **Two data-fetching philosophies.** Mobile uses TanStack Query in 30 hooks; web-v2 ships react-query as a peer of `@aivo/api-client` yet uses **zero** queries — 128 raw `fetch(` call sites (verified) with hand-rolled `.catch(() => {})` fallbacks, 6 of them inside the lesson player alone (`lesson-player.tsx:345,374,462,470,616,632`). No retry/dedupe/cache semantics on the web's most critical screens.
- **God components:** `MobileSurfaceRenderer.tsx` 1,578 lines; parent assessment page 1,144; `lesson-player.tsx` 1,133; `csv-import-wizard.tsx` 721. The two most pedagogically critical files are the two least maintainable.
- **Test distribution is inverted:** web-v2 has 135 test files, admin has 7 for 84 pages (admin correctness currently leans on root `e2e/specs/admin/*` and typed server actions); `packages/ui` (88 components) has ~1 test file.
- Dead/duplicated dependency surface: deprecated `@aivo/ops-alert` still present alongside `@aivo/ops-alerts` (`packages/ops-alert/package.json:5`); unused `@radix-ui/react-toast`; react-query installed-unused on web.
- Suspense/streaming essentially unused (1 instance), root layout force-dynamic — perceived performance leans entirely on dev-fast server renders rather than progressive streaming.

---

## 4. Top 10 highest-impact improvements (ranked: perceived quality gain ÷ effort)

1. **Remove the phantom learner from `/parent/home-v2`.** Wire the hero/metrics to `listLearnersForParent` (the same source `/parent/home` already uses) or hard-gate the route behind a feature flag + redirect until wired. Files: `apps/web-v2/app/parent/home-v2/page.tsx:39-42` (and the link in `app/parent/learners/[learnerId]/snapshot/page.tsx`). Effort: hours–1 day. This is the single cheapest trust repair in the repo.
2. **Make the axe suites a blocking CI lane.** Add a `web-a11y-e2e` job to `.github/workflows/ci.yml` running `pnpm --filter @aivo/web-v2 e2e --grep @a11y` against the mock-auth dev server (same harness this audit used — it boots clean), failing on serious/critical. The suites already exist (`apps/web-v2/e2e/*-a11y.playwright.ts`); this is wiring, not authoring. Extend route coverage to one page per role shell. Effort: 1–2 days.
3. **Wire the sensory adapter + reduced motion into the lesson runtimes.** Web: have the stage/lesson-player root consume `getCSSVars()` from `useSensoryAdapter` (`packages/stage-runtime/src/useSensoryAdapter.ts:127-135`) and scale pixi `Ticker`/transition durations by `--stage-animation-speed`; the `no-inert-prefs` gate (`scripts/a11y/no-inert-prefs.mjs`) should be extended to require a *stage* consumer token. Mobile: thread the existing `hooks/useReducedMotion.ts` through `MobileStageRuntime`/`MobileBeatRenderer` transition props. Effort: ~1 week. This closes the largest promise-vs-product gap.
4. **Give tutors faces; give rewards stickers.** Copy the existing tutor art from `apps/marketing/public/images/tutors/` into web-v2 + mobile assets, render via a shared `<TutorAvatar tutor={slug}>` in `packages/ui/src/baseline/TutorCard.tsx` (replacing emoji at `app/learner/home/page.tsx:484+`), and use `packages/brand/assets/mascots/*` for empty/celebration states on Rewards and Missions. Effort: 2–4 days. Highest visible-delight-per-hour in the audit.
5. **One primary action on learner home.** Demote the six-subject "0%" grid behind a single "Today's Mission" hero (the data already exists — `startMissionAction` on `app/learner/home/page.tsx`); move subjects to `/learner/subjects`; replace "0%" with stage-words ("just starting / growing / strong" — copy system already used by the parent summary). Implements the team's own Global Rule and UX-00 §8 LC-01. Effort: ~1 week incl. copy.
6. **Adopt one data-layer on web.** Stand up TanStack Query (already a peer dep) with a typed `apiClient` wrapper; migrate the lesson player + messages + parent dashboard first (the 6 swallowed catches in `lesson-player.tsx` become retry-with-toast). Define the rule in `docs/dev`: server components fetch on the server; client islands use queries; no bare `fetch` in components (enforceable via `no-restricted-imports`/`no-restricted-syntax`). Effort: 2–3 weeks incremental.
7. **Admin: confirmations + non-navigating feedback.** Add an `AlertDialog` primitive to `packages/admin-ui` and require it for destructive verbs (revoke SCIM token `district/sis/scim-section.tsx:117-127`, control/incident status flips, invite revocation); replace `?error=`/`?notice=` URL params with an `aria-live` flash region component retaining form state. Effort: ~1 week. Stripe-bar table stakes.
8. **Mobile sensory & reading parity.** Bundle Atkinson Hyperlegible via `expo-font`, add the `dyslexiaFriendlyFont` toggle to `apps/mobile/app/settings/accessibility.tsx` consuming the existing contract field; map web's standard/calm/high-contrast onto the mobile palette provider (high-contrast missing today); add `announceForAccessibility` for answer feedback in the stage. Effort: 1–2 weeks.
9. **Skeletons where users actually wait.** Add `loading.tsx` to the ~15 heaviest data routes (learner detail, gradebook, brain-profile, reports, billing) using a shared `<PageSkeleton variant>` in `packages/ui/src/states/`; on mobile, swap dashboard `ActivityIndicator`s for shimmer cards (`@aivo/mobile-ui` already exports a card kit). Add per-route-group `not-found.tsx` *inside* the role shells so 404s keep chrome (fixes [shot: 15-parent-404]). Effort: ~1 week.
10. **Split the two god files before they calcify.** `lesson-player.tsx` (1,133) → `useBeatMachine` hook + per-beat components + an `OutboxProvider`; `MobileSurfaceRenderer.tsx` (1,578) → per-surface renderer modules mirroring `packages/learner-surfaces`' structure (which already proves the decomposition shape). Effort: 2–3 weeks, parallelizable; pays for every future surface.

## 5. Roadmap to enterprise grade

### Quick wins (days)
| Item | Definition of done |
|---|---|
| Phantom-Emma fix (#1) | `/parent/home-v2` renders only real session learners; e2e assertion that hero name ∈ roster. |
| CI axe gate (#2) | PR fails on new serious/critical axe violation on ≥6 representative routes; badge in README. |
| Tutor art + mascots (#4) | No emoji tutor chips on learner home/baseline; Rewards empty state shows mascot; assets shared in `packages/brand`, not marketing-only. |
| Admin confirmations (#7a) | Zero destructive admin actions without typed/confirm step; verified by grep-gate in CI (`scripts/ci`). |
| Parent-chrome 404 (#9b) | `not-found.tsx` under `/parent`, `/learner`, `/teacher` shells; navigating to a bad learner id keeps the sidebar. |
| Dead-dep sweep | `@aivo/ops-alert`, `@radix-ui/react-toast` (or implement toasts), unused react-query either adopted (#6) or removed; `pnpm ls` clean. |
| Jargon pass | "Brain clone" never appears in parent/learner-facing strings (i18n catalog grep = 0); replaced with "learning profile" tier copy. |

### Structural (weeks)
| Item | Definition of done |
|---|---|
| Web data layer (#6) | 0 bare `fetch(` in `app/`/`components/` (lint-enforced); lesson player mutations retry + announce; swallowed-catch count in player = 0. |
| Learner home IA (#5) | One primary CTA above the fold at 768px; subject grid relocated; usability check with ≥3 target-age learners recorded in `docs/ux/a11y-audits/`. |
| Mobile parity (#8) | Dyslexia font + high-contrast live on mobile; `no-inert-prefs` passes with mobile stage consumers; TalkBack announces answer results (manual checklist row added). |
| Admin table ergonomics (#9-admin) | Tenants/users/learners/leads on the server-driven `DataTable` (search+sort+pagination+export); bulk select with audit-logged bulk actions on ≥2 list pages. |
| Skeleton coverage (#9) | `loading.tsx` on every route whose p95 server time >400ms (measure via existing OTel); CLS budget unchanged. |
| God-file decomposition (#10) | No app file >600 lines (CI check); lesson player and mobile renderer split with unchanged e2e suites green. |
| Sensory adapter end-to-end (#3) | Calm mode visibly slows/desaturates the stage (visual-regression snapshot per mode); pixi respects `motionScale: 0`. |

### Strategic (a quarter)
| Item | Definition of done |
|---|---|
| Per-tutor lesson identity | Lesson chrome themes (palette/mascot/voice line) derive from `TUTORS[slug]`; two tutors' lessons are visually distinguishable in a 5-second screenshot test; theming matrix added to the visual suite. |
| Theming test matrix | Visual regression across {3 sensory modes × 5 role themes} for the 10 highest-traffic screens, in CI (extends `visual-a11y.playwright.ts` + the existing anti-blank guard). |
| Postgres RLS backstop | RLS policies on tenant-scoped tables; staging chaos test proving an unscoped query returns 0 rows; app-layer behavior unchanged. |
| Privacy-safe product analytics (or ADR not to) | Either a COPPA-filtered, self-hosted analytics pipeline measuring activation/lesson-completion funnels with no child PII, or ADR 00xx documenting the deliberate absence and the operational substitutes. |
| Offline lesson content (mobile) | A queued "next lesson" playable fully offline; outbox conflict policy documented (server-wins + parent-visible "synced later" stamp). |
| Audit coverage by default | Write-route lint requiring `@audited(...)` or an explicit `@unaudited(reason)`; coverage report in admin (`/platform/audit`). |
| Admin i18n decision | If district self-serve is on the roadmap: next-intl in web-admin with es/fr first; else ADR documenting English-only for internal operators. |

---

## Appendix — corrections to the repo's own audit docs (so this report doesn't compound them)

| Internal doc claim (2026-05-17) | Status verified 2026-06-12 |
|---|---|
| "`/signup` disabled, `/login` is a mock role picker" (UX-00 §1) | **Fixed** — real identity-svc login w/ MFA cookie flow (`app/login/page.tsx:43-111`), real `registerAction` signup; mock is dev-only behind `AUTH_MODE=mock`. |
| "Web lacks forgot/reset password, verify-email" (BF-08/09) | **Mostly fixed** — `/forgot-password`, `/reset-password`, `/login/mfa` exist; ❓ dedicated `/verify-email` still not found (parent-verify covers a different gate). |
| "Skip link not actually rendered" (UX-14 A1) | **Fixed** — `globals.css:70-82` + app-shell renders it. |
| "Dyslexia-friendly font mode not wired" (DD-13) | **Fixed on web** (`fonts-dyslexia.css`, `[data-typeface="dyslexia"]`); still true on mobile. |
| "AAC fields not in BFF PatchSchema" (remediation playbook) | **Fixed** — schema now imported from the contract incl. AAC (`accessibility/route.ts:8,20-24`). |
| "No role switcher on mobile" (BF-07) | **Partially fixed** — `(auth)/session-switch` exists (ADR 0020); five-group architecture remains. |
| "Reduced motion not honored in Stage/quests" (UX-14 A4) | **Still true** for pixi canvas + mobile stage runtime (the one finding that survived). |

*Recommendation: stamp these docs with a "verified-against-commit" SHA and add a staleness check to CI — an enterprise buyer reading `docs/ux/UX-00-audit.md` today would conclude the product has no auth.*

---

*Report generated by a read-only audit. No code was modified; this file is intentionally untracked. Live verification used `AUTH_MODE=mock` on web-v2 only; admin and mobile were audited from code. Screenshots referenced as `[shot: …]` were captured at 1380×900 from the running dev server and stored outside the repo.*
