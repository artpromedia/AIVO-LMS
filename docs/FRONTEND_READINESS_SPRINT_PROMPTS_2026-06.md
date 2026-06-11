# Frontend Readiness — Sprint-by-Sprint Implementation Prompts

_Date: 2026-06-10 · Derived from: `docs/FRONTEND_PRODUCTION_READINESS_REVIEW_2026-06.md` · Scope: `apps/web-v2`, `apps/web-admin`, `apps/mobile`, `apps/marketing`, shared frontend packages_

> **Purpose:** Executable backlog to take the frontend from "nearly ready" to **user-production-ready
> (Track A)** and **enterprise/RFP-ready (Track B)**. Each sprint is a self-contained, ready-to-paste
> prompt for one engineer or coding agent, in the same style as
> `docs/PRODUCTION_READINESS_SPRINT_PROMPTS.md`. Every prompt names what to **DELETE**, **CREATE**,
> **REFACTOR**, or **EDIT**, and every sprint lands **end-to-end** (UI → BFF → service → DB where
> applicable) with **zero placeholders, zero stubs, zero "coming soon"** — the repo's own gates
> (`prod:no-demo`, `check:no-coming-soon`, no-stub-gate) enforce this and must stay green.

---

## Rules that apply to EVERY sprint below

Paste this block at the top of each sprint prompt when dispatching it:

```
House rules (non-negotiable):
1. No placeholders, stubs, mock data, TODO/FIXME comments, or "coming soon" prose anywhere
   in the delivered code. `pnpm prod:no-demo`, `pnpm check:no-coming-soon`, and the no-stub
   CI gate must pass. If a dependency is genuinely out of scope, fail closed with a real
   error path — never a silent stub.
2. Wire features end-to-end: UI → BFF/route handler → service → DB (with migration) where
   state is involved. A feature that renders but does not persist/read real data is not done.
3. Every new user-facing string goes through i18n with keys added to ALL 10 locales
   (en, es, fr, de, pt, zh, ja, ko, ar, hi). `pnpm i18n:coverage` and the extract gate must pass.
4. Every new capability ships with its own regression guard: extend the matching audit script
   in scripts/ AND register it in BOTH scripts/release-gate.mjs and
   .github/workflows/production-gates.yml (the release-gate header comment requires both).
5. Tests are part of the deliverable: unit tests for pure logic, integration/Playwright/Maestro
   for flows. No skipped tests, no .only.
6. Accessibility is a launch property, not polish: new UI honors the @aivo/accessibility-contract
   preferences (reduced motion, contrast, font, AAC where relevant).
7. Before opening the PR run: pnpm release:gate, pnpm typecheck + pnpm test in touched
   workspaces, and the sprint's own acceptance commands listed at the bottom of the prompt.
8. One sprint = one branch = one PR. Do not bundle sprints.
```

---

## Evidence index (why each sprint exists)

| Sprint | Driving finding | Evidence |
| --- | --- | --- |
| A1 | `release:gate` 19/20 (auth:audit red); school dashboard frozen to 2024; lifeSkills scaffold blocks strict prod:check; vitest CRITICAL CVE keeps security-scan red; visual baselines are blank PNGs | `pnpm release:gate` run 2026-06-10; `apps/web-admin/app/school/page.tsx:64-66`; `pnpm prod:check`; issues #68/#69; `apps/web-v2/e2e/visual-a11y.playwright.ts-snapshots/*` (4 identical blank 4,254-byte PNGs) |
| A2 | Zero client-side error tracking / web vitals on all 3 app surfaces; no mobile error boundary; admin leaks backend strings into `?error=` URLs | no `@sentry/*` in any app package.json; no ErrorBoundary in apps/mobile; `apps/web-admin/app/platform/security/controls/page.tsx:17-19` pattern |
| A3 | Production ZAP scans: CSP absent, anti-CSRF absent, `X-Powered-By` leaking, COOP/CORP missing, potential XSS on admin `/login?next=`, unhardened cookie on admin `/`, no HSTS on static files | GitHub issues #65 (release-blocker) and #73; `poweredByHeader` absent from both `next.config.ts` |
| A4 | Mobile `accessibilityLabel/Role` coverage sparse; switch-scanning AAC overlay rendered with `items={[]}` (non-functional) | `apps/mobile/app/(learner)/_layout.tsx:65`; grep across `apps/mobile/app` |
| A5 | iOS Privacy Manifest missing; store screenshot dirs empty; privacy-policy/support URLs unset | `apps/mobile/app.json` ios block; `apps/mobile/store-assets/screenshots/**/.gitkeep` |
| A6 | No push notification handlers/tap-routing; no explicit under-13 age gate; two divergent offline queues | `apps/mobile/app/_layout.tsx`; `apps/mobile/app/(onboarding)/`; `apps/mobile/app/(learner)/stage/[sessionId].tsx:38-99` vs `apps/mobile/lib/offline-queue.ts` |
| A7 | No blocking end-to-end user-journey suite (web-v2 has BFF/contract specs only; web-admin has zero e2e; mobile has zero e2e) | `apps/web-v2/tests/e2e/`, `apps/web-admin/` (no playwright), `apps/mobile/` (no maestro/detox) |
| A8 | Timezone hardcoded to `America/New_York`; accessibility preference changes don't propagate live | `apps/web-v2/lib/i18n/request.ts:18` |
| B1 | SSO is SAML-only; OIDC (Okta/Entra/Google) not implemented | `packages/sso/src/index.ts` (node-saml wrapper only) |
| B2 | Feature flags are env-scoped; no per-tenant overrides, pilots, or kill switches | `packages/feature-flags/src/enterprise-flags.ts` |
| B3 | Admin tables hard-capped at 200 rows; no pagination/sort/search/CSV export | `packages/admin-api/src/audit.ts` (`listAdminAuditLogs(session, 200)` callers); `apps/web-admin/components/admin-tables.tsx` |
| B4 | Audit log covers mutations only — sensitive reads (PII views) unaudited; no district-facing export/verification | `apps/web-admin/app/platform/users/[id]/page.tsx`; `packages/audit-client` |
| B5 | No SCIM provisioning (CSV/SIS import only) | `services/integration-svc`, `services/integrations-svc` route scan |
| B6 | No per-tenant white-labeling (logo/colors) | `packages/brand` (no tenant dimension) |
| B7 | No Lighthouse/bundle/coverage budgets in blocking CI; token math duplicated across 4 theme implementations; no living Storybook | `.github/workflows/marketing-lighthouse.yml` (continue-on-error); `packages/{learner-ui,mobile-ui,stage-ui}` theme files; `packages/learner-ui/storybook-static` (stale artifact) |

Track A (A1→A8) gates **user production launch**. Track B (B1→B7) gates **enterprise/district RFPs**;
B-track sprints are parallelizable once A3 lands. Recommended order within B: B1 → B2 → B3 → B4,
with B5/B6/B7 schedulable in parallel after B2.

---

# Track A — User production readiness

### Sprint A1 — Re-green every gate and make the test signals truthful

```
Goal: every self-reported signal in this repo tells the truth and is green. Four red/lying
signals exist today; close all four end-to-end. No suppressions without recorded rationale.

1) auth:audit regression (release:gate is 19/20).
EDIT apps/web-v2/lib/auth/mock-session.ts:
  - readMockSessionFromCookies() (~line 167) and getMockSession() (~line 177) must each call
    mockAuthAllowed() and return null BEFORE touching any cookie, as scripts/auth-mode-audit.mjs
    requires. Keep the existing delegation to readMockBaseSession()/readMockBaseSessionFromRequest()
    — the explicit guard is defense-in-depth on top of it, matching the documented Sprint 03/G1
    contract in this file's header comment.
  - Add a unit test in apps/web-v2/lib/auth/ asserting both functions return null when
    serverEnv.AUTH_MODE !== "mock" even when a forged aivo_mock_session cookie is present.

2) School dashboard is frozen to 2024.
EDIT apps/web-admin/app/school/page.tsx (~lines 63-66): delete the hardcoded
  startDate: "2024-09-01" / endDate: "2024-12-20".
CREATE apps/web-admin/lib/report-window.ts exporting currentTermWindow(now: Date) that returns
  a rolling school-term window (Aug 1–Jan 31 → fall term, Feb 1–Jul 31 → spring term, in the
  tenant's locale-agnostic ISO dates), plus lastNDaysWindow(now, n). Use currentTermWindow()
  in school/page.tsx. Sweep apps/web-admin/app/**ALL** pages for other hardcoded date literals
  (grep for /20\d\d-\d\d-\d\d/) and convert any others found the same way.
  Unit-test the window math including the year boundary.

3) tutor-svc lifeSkills scaffold blocks strict prod:check.
EDIT services/tutor-svc/src/modes/lifeSkillsTutor.ts: author the missing coverage-matrix bands
  with real content (follow the authored-band pattern used by the other tutors in
  services/tutor-svc/src/modes/) OR, if a content owner attests specific bands as intentionally
  scaffold for GA, mark them exactly the way commit dfdd490e marked PRE-K (owner attestation
  recorded in the file + docs). Either way `NODE_ENV=production pnpm prod:check` must exit 0
  and scripts/production-gap-gate.mjs must report 0 findings. Do not weaken the gate.

4) vitest CRITICAL advisory (GHSA-5xrq-8626-4rwp) keeps security-scan.yml red (issues #68/#69).
REFACTOR vitest ^2 → ^4 in every workspace that pins it: apps/web-v2, apps/mobile,
  tests/integration, services/{audit-svc,tenant-svc,subject-brain-svc,integration-svc,
  status-page-svc,science-solver-svc,i18n-svc,homework-svc}, plus any @vitest/* companions
  (coverage-v8, ui) — move them together. Fix the known v3/v4 breakages (default pool
  threads→forks, reporter output, expanded fake-timer toFake set) until `pnpm test` passes in
  every touched workspace. Also reconcile root package.json devDependencies."vitest": "^2.0.0".
EDIT package.json: DELETE "GHSA-5xrq-8626-4rwp" from pnpm.auditConfig.ignoreCves — after the
  upgrade the ignore must be unnecessary. `pnpm audit --audit-level=high` must exit 0.
  Close issues #68 and #69 with the verification output.

5) Visual-regression baselines are blank white images (test theater).
DELETE all four PNGs in apps/web-v2/e2e/visual-a11y.playwright.ts-snapshots/ and the blank
  "after" captures in screenshots/design-language/ (landing-after.png, login-after.png,
  learner-home-after.png, rewards-after.png).
EDIT apps/web-v2/e2e/visual-a11y.playwright.ts: before each toHaveScreenshot assertion, take
  a buffer screenshot and fail loudly if it is near-uniform (e.g. decode with pngjs — already
  transitively available, otherwise add as devDependency — and assert pixel stddev above a
  small threshold). This makes blank captures impossible to commit again.
  Regenerate real baselines against the seeded dev server (pnpm --filter @aivo/web-v2 build &&
  start with AUTH_MODE=mock, same as the bff-integration CI job) and commit PNGs that visibly
  contain the landing, login, learner home, and rewards screens.
  Regenerate the design-language screenshots via the same flow used by
  .github/workflows/design-language.yml.

Acceptance (all must pass):
  pnpm release:gate                      → 20/20 PASS
  NODE_ENV=production pnpm prod:check    → exit 0
  pnpm audit --audit-level=high          → exit 0
  pnpm --filter @aivo/web-v2 exec playwright test e2e/visual-a11y.playwright.ts → pass with
    non-blank committed baselines
  pnpm test in every workspace touched by the vitest upgrade → pass
```

### Sprint A2 — Observability end-to-end: Sentry on all three surfaces, mobile error boundaries, web vitals

```
Goal: a crash or error on ANY surface (web-v2, web-admin, mobile) is visible in Sentry within
seconds, tagged with release + surface + route, with COPPA-safe scrubbing. A child's broken
lesson must never again be invisible.

web-v2:
CREATE apps/web-v2/instrumentation.ts, apps/web-v2/instrumentation-client.ts and
  apps/web-v2/sentry.server.config.ts per current @sentry/nextjs conventions (App Router,
  Next 15). Wrap next.config.ts with withSentryConfig (source-map upload, release =
  VERCEL_GIT_COMMIT_SHA || GITHUB_SHA).
EDIT apps/web-v2/lib/env.ts: add NEXT_PUBLIC_SENTRY_DSN (client schema) and SENTRY_AUTH_TOKEN /
  SENTRY_ENVIRONMENT (server schema, optional in dev, REQUIRED when NODE_ENV=production —
  follow the existing fail-fast pattern at lines 85-270).
CREATE apps/web-v2/lib/observability/scrub.ts: a beforeSend/beforeSendTransaction hook that
  drops cookies and request bodies, hashes userId/tenantId, and strips any key matching
  learner|email|name|iep|medical from event contexts. Unit-test the scrubber with fixture
  events — this is the COPPA boundary, treat it as security code.
EDIT apps/web-v2/app/error.tsx and global-error.tsx: report the error via Sentry.captureException
  before rendering recovery UI (keep the existing stale-action auto-reload behavior).
CREATE apps/web-v2/components/web-vitals-reporter.tsx using next/web-vitals
  useReportWebVitals → Sentry metrics; mount it in app/layout.tsx.

web-admin:
Same shape: CREATE instrumentation + client/server Sentry configs, wire withSentryConfig in
  next.config.ts, extend its env validation, reuse the scrubber (CREATE
  packages/observability/src/sentry-scrub.ts and import it from BOTH apps rather than
  duplicating; export it from packages/observability/src/index.ts).
REFACTOR the error-to-URL pattern: today server actions redirect with raw backend messages
  (e.g. apps/web-admin/app/platform/security/controls/page.tsx:17-19 actionError()).
CREATE apps/web-admin/lib/action-errors.ts: map AdminApiError → stable error CODES
  (e.g. "control_update_failed"); pages render an i18n message for the code; the raw error
  goes to Sentry/server logs only. EDIT every page using the `?error=` pattern (grep
  "error=" across apps/web-admin/app) to use the new mapping. No backend strings in URLs.

mobile:
Add @sentry/react-native; initialize in apps/mobile/app/_layout.tsx before the router mounts,
  with release/dist wired to EAS build values and the shared scrubbing rules (no learner PII).
CREATE apps/mobile/components/ErrorBoundary.tsx: a real React error boundary (class component)
  rendering a friendly, i18n'd, reduced-motion-safe recovery screen with "try again" (resets
  boundary) and "go home" actions; reports to Sentry with the failing route name.
EDIT apps/mobile/app/_layout.tsx: wrap the navigator with it.
EDIT apps/mobile/app/(learner)/stage/[sessionId].tsx: wrap the stage player in a second,
  stage-specific boundary whose recovery path FIRST enqueues the session-end payload to the
  offline queue (reuse the existing queueing at lines 38-99) so a crash never loses a child's
  progress, THEN offers resume. Unit-test: thrown render error → payload queued → recovery UI.
EDIT apps/mobile/constants/api.ts:77: in addition to console.warn on missing EXPO_PUBLIC_API_URL,
  capture a Sentry message and surface an in-app config-error screen instead of silently
  broken requests.

CI:
EDIT .github/workflows/ci.yml (or the relevant deploy workflows): provide SENTRY_AUTH_TOKEN
  secret for source-map upload on production builds; builds must not fail when the token is
  absent on forks (guard the plugin on env presence).

Regression guard:
CREATE scripts/observability-audit.mjs verifying: (a) each of the 3 apps has Sentry init files,
  (b) the scrubber is imported in each beforeSend, (c) apps/mobile has an ErrorBoundary wrapping
  the root navigator, (d) no DSN is hardcoded (must come from env). Register in
  scripts/release-gate.mjs AND .github/workflows/production-gates.yml.

Acceptance:
  - Throw a deliberate error behind a dev-only trigger on each surface (web-v2 route handler,
    web-admin server action, mobile button in the dev menu); show each arriving in Sentry with
    scrubbed payloads, then remove the triggers.
  - pnpm release:gate → 21/21 (new gate included).
  - Web-vitals events visible for / and /learner/home.
```

### Sprint A3 — Security hardening: CSP, CSRF, header gaps; close ZAP issues #65 and #73

```
Goal: the next scheduled run of .github/workflows/zap-baseline.yml against
admin.aivolearning.com and district.aivolearning.com reports zero of the currently-open alert
classes, and issues #65 (release-blocker) and #73 are closed with evidence.

Headers (both apps):
EDIT apps/web-v2/next.config.ts and apps/web-admin/next.config.ts:
  - Add poweredByHeader: false (removes the X-Powered-By leak).
  - Extend SECURITY_HEADERS with Cross-Origin-Opener-Policy: same-origin and
    Cross-Origin-Resource-Policy: same-origin. Evaluate Cross-Origin-Embedder-Policy:
    credentialless — enable it only if all cross-origin subresources still load (see the
    font change below); document the decision inline.
  - Ensure headers() also matches static/metadata routes flagged by ZAP (robots.txt,
    sitemap.xml, manifest.webmanifest): add an explicit source entry so HSTS and
    X-Content-Type-Options cover them.

Remove the third-party font origin instead of allowlisting it:
DELETE the Fontshare CDN <link> usage in apps/web-v2/app/layout.tsx (~lines 96-107).
CREATE apps/web-v2/public/fonts/ with the self-hosted Satoshi Variable woff2 files and a
  @font-face block (font-display: swap) in app/globals.css, or switch the display face to the
  already-self-hosted next/font setup. Licensing: Satoshi's ITF license permits self-hosting;
  record the license file alongside the fonts. This removes the only external style/font origin,
  making CSP strict and SRI moot for styles.

CSP (both apps, nonce-based, enforced — not report-only at sprint end):
EDIT apps/web-v2/middleware.ts and apps/web-admin/middleware.ts: generate a per-request nonce,
  set Content-Security-Policy with default-src 'self'; script-src 'self' 'nonce-…'
  'strict-dynamic'; style-src 'self' 'nonce-…'; img-src 'self' data: blob:; font-src 'self';
  connect-src 'self' plus the Sentry ingest origin from env; frame-ancestors 'none';
  report-uri /api/bff/csp-report. Pass the nonce to Next via the documented x-nonce request
  header pattern so framework inline scripts are nonced.
  KaTeX (apps/web-v2/components/**/math-text.tsx) injects inline styles — verify it renders
  under the nonce'd style-src; if KaTeX requires inline style attributes, scope an explicit
  style-src-attr 'unsafe-inline' ONLY if proven necessary and document why next to the header.
CREATE apps/web-v2/app/api/bff/csp-report/route.ts (and the web-admin equivalent): accept
  report payloads, log via the existing pino logger at warn with requestId, forward to Sentry.
  Roll out as Content-Security-Policy-Report-Only for the FIRST commit, run the full e2e suite
  (A7 if landed, else the existing bff + visual suites) to harvest violations, fix them, then
  flip to enforcing in the SAME PR. The PR must merge in enforcing mode.

CSRF:
CREATE apps/web-v2/lib/bff/csrf.ts: requireSameOrigin(req) that rejects state-changing requests
  (POST/PUT/PATCH/DELETE) unless (a) Sec-Fetch-Site is same-origin/none, or (b) Origin matches
  the app origin from env. EDIT apps/web-v2/lib/bff/guards.ts so requireSession() composes it
  for mutating methods. Mirror the same guard for web-admin server routes
  (apps/web-admin/app/logout/route.ts and any route handlers accepting POST).
EDIT packages/api-client (the browser fetch wrapper used by web-v2 client components) to send
  X-Aivo-Request: 1 on mutations; the guard additionally accepts only requests bearing it
  (custom headers force a CORS preflight, which 'self'-only CORS denies cross-origin).
  Add unit tests: cross-origin POST without header → 403; same-origin with header → pass.
  Note in docs/security/csrf.md how this composes with the existing sameSite=lax cookies
  (apps/web-v2/lib/auth/session-cookies.ts:36-38) and Next Server Actions' built-in origin
  checks — this document is what enterprise security reviewers will ask for.

Admin /login findings:
INVESTIGATE the ZAP "User Controllable HTML Element Attribute (Potential XSS)" on
  admin /login?next=…: locate where the next param is read in apps/web-admin/app/login/ and
  constrain it to an allowlisted same-origin path (reuse the safe-redirect helper pattern from
  app/logout/route.ts lines 24-29; extract it into apps/web-admin/lib/safe-redirect.ts and use
  it in BOTH places). Add a unit test rejecting absolute URLs, protocol-relative URLs, and
  javascript: values.
IDENTIFY the cookie ZAP flags as missing HttpOnly/Secure on admin / and /login (the session
  cookies in packages/admin-auth/src/session-cookies.ts are hardened, so this is another
  cookie — likely the locale or a Next prefetch cookie). Capture Set-Cookie headers from a
  local prod build, identify it, and set httpOnly/secure/sameSite where server-set; if it is
  intentionally client-readable (locale), set secure + sameSite and document it in
  docs/security/cookies.md.

Regression guards:
EDIT scripts/security-audit.mjs (Tier A): assert poweredByHeader:false in both next configs,
  CSP set in both middlewares, and the csrf guard wired in lib/bff/guards.ts.
CREATE apps/web-v2/e2e/security-headers.playwright.ts (and a web-admin equivalent under its
  new e2e setup or a curl-based script in scripts/ci/): assert CSP, COOP, CORP, HSTS,
  nosniff on /, /login, and /robots.txt responses.

Acceptance:
  - pnpm security:audit → pass; pnpm release:gate → all green.
  - Header e2e spec green against a local production build (pnpm --filter @aivo/web-v2 build && start).
  - Re-run ZAP baseline (workflow_dispatch .github/workflows/zap-baseline.yml) → 0 alerts in the
    classes listed in #65/#73; close both issues citing the run.
  - Full existing e2e + visual suites green under ENFORCING CSP.
```

### Sprint A4 — Mobile accessibility: screen-reader coverage and a working switch-scanning AAC overlay

```
Goal: a VoiceOver/TalkBack user can operate every core mobile flow, and switch-access scanning
actually works for motor-impaired learners. This is a launch gate for this product, not polish.

Screen-reader coverage (mechanical, lint-driven — no judgment sampling):
EDIT apps/mobile/eslint.config.mjs: add eslint-plugin-react-native-a11y (all/strict ruleset:
  has-accessibility-props, has-valid-accessibility-role, touchable-has-alt, etc.) at error level
  scoped to app/**, components/**, src/**.
EDIT every flagged file until `pnpm --filter @aivo/mobile lint` is clean: each Pressable/
  Touchable/Button/Switch/TextInput gets accessibilityRole, accessibilityLabel (i18n'd — add
  keys to all 10 locale files in apps/mobile/i18n/), and accessibilityState where stateful
  (selected tabs, toggles, disabled buttons). Decorative icons get
  accessibilityElementsHidden/importantForAccessibility="no".
  Use the existing announce() live-region helper from apps/mobile/lib/a11y-style.tsx for
  async outcome announcements (answer submitted, badge earned, sync restored) in the stage,
  homework, and offline-banner flows.

Switch scanning — make it real:
The overlay is currently mounted dead: apps/mobile/app/(learner)/_layout.tsx:65 renders
  <SwitchScanOverlay active={switchScanEnabled} items={[]} />.
CREATE apps/mobile/src/components/switch-scan/ScanTargetRegistry.tsx: a context provider with
  registerScanTarget({ id, label, order, onActivate, ref }) / unregister, returning targets in
  visual order. Mount the provider in app/(learner)/_layout.tsx.
CREATE apps/mobile/src/components/switch-scan/useScanTarget.ts hook for screens to register
  their primary actions.
REFACTOR apps/mobile/src/components/SwitchScanOverlay.tsx to consume the registry: highlight
  cycles through targets at the learner's aacScanDelayMs (read from the accessibility profile
  via the existing accessibility settings source; clamp to the 300–5000ms bounds from
  @aivo/accessibility-contract), announces each focused label via announce(), and activates the
  focused target on switch input (screen tap in switch_1 mode; volume-key support if the
  current expo config exposes it — if not, tap-anywhere is the supported input and is documented).
EDIT the learner screens to register real targets: home (each mission/quest card + tab bar),
  stage player (answer choices + continue/break buttons), homework (reply + send), rewards
  (each badge group). DELETE the items prop from the overlay call sites — the registry is now
  the single source.
Tests: unit tests for registry ordering/cleanup and scan-timer behavior (fake timers, clamped
  delays); a vitest test asserting every (learner) route registers ≥1 scan target when
  switchScanEnabled (render with the provider and assert registry non-empty).

Manual screen-reader pass:
CREATE docs/accessibility/mobile-screenreader-checklist.md: per-screen VoiceOver + TalkBack
  scripts for login, onboarding consent, learner home, stage play, homework, parent home, and
  settings; run both and record pass/fail + device/OS in the doc. Fix what fails. The doc ships
  with real recorded results, not an empty template.

Regression guard:
CREATE scripts/mobile-a11y-label-ratchet.mjs: counts interactive elements lacking
  accessibility props under apps/mobile (same AST/grep approach as the existing audits) against
  a committed baseline of 0; any growth fails. Register in release-gate + production-gates.yml.
  (The eslint rule is the primary gate; the ratchet catches files eslint doesn't parse.)

Acceptance:
  pnpm --filter @aivo/mobile lint → clean with the new a11y plugin at error level
  pnpm --filter @aivo/mobile test → green including new registry/overlay tests
  pnpm release:gate → green including the new ratchet
  Checklist doc contains recorded VoiceOver + TalkBack results for all listed screens
```

### Sprint A5 — Mobile store submission pack (iOS privacy manifest, listings, screenshots)

```
Goal: an `eas build --profile production` for iOS and Android produces artifacts that App Store
Connect and Play Console accept without metadata rejections, and the store listing assets exist
in-repo.

iOS privacy manifest:
EDIT apps/mobile/app.json → expo.ios: add the privacyManifests key declaring
  NSPrivacyAccessedAPITypes actually used by the app/Expo SDK (UserDefaults CA92.1,
  FileTimestamp C617.1, SystemBootTime 35F9.1, DiskSpace E174.1 — verify against the Expo SDK
  version's documented set) and NSPrivacyCollectedDataTypes matching reality: account info
  (email), user content (learner responses), identifiers (user ID) — all "app functionality",
  none "tracking"; NSPrivacyTracking: false. Cross-check each declared type against
  docs/legal/privacy-program.md so the manifest, the privacy policy, and the Play data-safety
  form say the SAME thing. Run npx expo prebuild -p ios locally and verify PrivacyInfo.xcprivacy
  is emitted containing the declarations.

Store URLs and review metadata:
EDIT apps/mobile/app.json: add the public privacy policy URL
  (https://aivolearning.com/privacy-policy — the route exists in apps/marketing) wherever the
  config supports it, and CREATE apps/mobile/store-assets/listing.json holding the canonical
  store metadata (privacy policy URL, support URL, marketing URL, category, content rating
  answers, COPPA "designed for families" answers for Play, App Store Kids Category decision +
  age band). Derive the answers from docs/compliance/state-privacy-matrix.md — do not invent.
CREATE docs/mobile/store-submission.md: the runbook mapping listing.json to the App Store
  Connect privacy questionnaire and the Play Data-Safety form, field by field, with the
  rationale for each answer. This is the doc a reviewer signs off on.

Screenshots — generated from the real app, committed:
CREATE apps/mobile/.maestro/store-screens.yaml: Maestro flows that log in with the seeded demo
  accounts, navigate to the 7 listing screens (learner home, stage play, homework helper,
  parent progress, parent "what's working", teacher overview, accessibility settings), and
  capture screenshots.
CREATE apps/mobile/scripts/capture-store-screenshots.mjs: drives Maestro against iOS simulators
  (6.9" iPhone 16 Pro Max 1320×2868 and 6.5" 1284×2778) and an Android emulator (1080×2400),
  writing into the existing store-assets/screenshots/{ios,android}/<size>/ tree (the README
  there documents required sets). Run it and COMMIT the EN screenshot set. DELETE the .gitkeep
  files once real assets exist.

EAS sanity:
Verify ownership: run `eas whoami` / `eas project:info`; if the configured owner
  ("iamofemeofem", app.json:122) is wrong, EDIT app.json owner + extra.eas.projectId to the
  real account. Record the verification output in docs/mobile/store-submission.md.

Regression guard:
EDIT scripts/mobile-unified-audit.mjs (pnpm mobile:audit): fail if (a) ios.privacyManifests is
  absent, (b) store-assets/listing.json is missing required fields, or (c) any
  store-assets/screenshots/<platform>/<size>/ dir required by its README is empty.

Acceptance:
  pnpm mobile:audit → green with the new checks
  npx expo prebuild -p ios → PrivacyInfo.xcprivacy present with the declared types
  store-assets contains committed, non-empty EN screenshots at the required sizes
  eas build --profile production --platform all → completes (record build IDs in the runbook)
```

### Sprint A6 — Mobile runtime completeness: push routing, under-13 age gate, one offline queue

```
Goal: notifications actually navigate, COPPA age determination is explicit, and there is exactly
one offline replay mechanism.

Push notifications end-to-end:
The permission priming exists (apps/mobile/app/(onboarding)/permissions.tsx) and the
  expo-notifications plugin is configured (app.json), but nothing handles delivery or taps.
CREATE apps/mobile/lib/notifications.ts: setNotificationHandler (foreground presentation),
  registerForPushToken() obtaining the Expo push token after permission grant, and
  routeFromNotification(response) mapping the notification's data.path to an expo-router
  navigation (reuse the deep-link path conventions already declared in app.json intentFilters).
EDIT apps/mobile/app/_layout.tsx: install the handler + addNotificationResponseReceivedListener
  on mount; handle the cold-start case via getLastNotificationResponseAsync.
Device registration must persist server-side: locate the comms-svc notification dispatch path
  (services/comms-svc). If a device-token registration route exists, wire to it; if not,
  CREATE in services/comms-svc: a device_push_tokens table migration in packages/db
  (userId, expoPushToken, platform, lastSeenAt, unique on token), POST/DELETE
  /api/comms/devices routes guarded by the platform auth contract, and integrate token lookup
  into the existing send path so real pushes reach devices. Token is registered on login and
  revoked on logout (EDIT apps/mobile/hooks/useAuth.ts login/logout paths).
Tests: comms-svc route tests (register/dedupe/revoke); mobile unit test for
  routeFromNotification path mapping.

Under-13 age gate (web + mobile parity):
CREATE apps/mobile/app/(onboarding)/child-age.tsx: collects the learner's date of birth before
  the child-approval step (EDIT apps/mobile/app/(onboarding)/_layout.tsx flow order). Store
  birthDate on the learner record: if the learner creation payload/schema lacks it, EDIT the
  owning service (family-svc learner creation) + packages/db migration to add it, and compute
  requiresParentConsent = age < 13 server-side, persisting the determination alongside the
  existing consent records (align with the AgeGateRecord semantics referenced in
  docs/compliance/state-privacy-matrix.md). The existing parent-consent sheet
  (apps/mobile/app/(auth)/consent-sheet.tsx) becomes conditionally REQUIRED by that server
  determination rather than assumed.
EDIT the matching web-v2 onboarding learner step (apps/web-v2/app/onboarding/learner/) to
  collect the same DOB field if absent, hitting the same BFF/service path. One source of truth,
  two surfaces.
EDIT scripts/consent-gate-audit.mjs (pnpm consent:audit): assert the age-gate step exists in
  both onboarding flows and that learner creation carries birthDate.
Tests: service-level test that <13 forces requiresParentConsent and blocks activation until
  consent; ≥13 path does not regress existing consent toggles.

One offline queue:
REFACTOR apps/mobile/app/(learner)/stage/[sessionId].tsx (~lines 38-99): DELETE the bespoke
  AsyncStorage session-end outbox and enqueue through apps/mobile/lib/offline-queue.ts instead.
  EDIT lib/offline-queue.ts to support a priority lane so session-end payloads replay before
  lower-value actions, keeping idempotency keys and the 7-day TTL. Migrate any payloads found
  under the old storage key on first run (read old key → enqueue → remove key) so no queued
  session from a previous app version is lost.
Tests: EDIT apps/mobile/__tests__/offline-queue.test.ts for the priority lane + migration;
  stage test asserting failed session-end lands in the unified queue and replays on reconnect.

Acceptance:
  pnpm consent:audit → green with new assertions
  pnpm --filter @aivo/mobile test && pnpm --filter @aivo/comms-svc test → green
  Manual: tap a staging push → app routes to the target screen (record in PR)
  grep confirms the old stage outbox storage key no longer exists outside the migration shim
```

### Sprint A7 — Blocking end-to-end user journeys (web-v2, web-admin, mobile)

```
Goal: the flows that earn trust are exercised on every PR against the real service stack —
not just BFF contracts. A red journey blocks merge.

Infrastructure:
Reuse docker-compose.e2e.yml (postgres, redis, identity-svc, integration-svc, admin-svc,
  learning-svc, web-v2) and e2e/lib/fixtures.ts seeding. EDIT docker-compose.e2e.yml to also
  build/run apps/web-admin (it has a Dockerfile; expose 5001) so admin journeys run against
  real identity + admin-svc — real auth mode, NOT AUTH_MODE=mock.

web-v2 journeys — CREATE under e2e/specs/journeys/ (root e2e workspace, same conventions as
  e2e/specs/district-pilot/):
  1. parent-onboarding.spec.ts: signup → verify → consent (assert the consent ledger row via
     BFF) → add learner WITH date of birth → baseline/discovery start → first lesson beat
     renders → parent home shows the learner.
  2. learner-lesson.spec.ts: learner login → today's mission → complete a lesson run →
     progress + rewards reflect it (assert persisted lesson-run via API, not just UI).
  3. parent-reports.spec.ts: parent opens reports + "what's working" → panels render real data
     from the seeded ef_session_outcomes fixtures → DSAR export request from
     /parent/privacy/data-export creates a tracked request.
  4. teacher-assign.spec.ts: teacher creates an assignment → learner sees and completes it →
     teacher insight reflects completion.

web-admin journeys — apps/web-admin currently has NO e2e:
CREATE apps/web-admin/playwright.config.ts (mirror web-v2's) and apps/web-admin/e2e/:
  1. login-mfa.spec.ts: staff login → MFA challenge → role home; wrong code → locked state
     copy on 429.
  2. pilot-provision.spec.ts: platform_admin provisions a pilot district → tenant exists →
     audit log page shows the provisioning event (this also covers RBAC: a support-role session
     must NOT reach the provision action — assert 403/redirect).
  3. rbac-boundaries.spec.ts: district_admin cannot load /platform/*; school_admin cannot load
     /district/*; assert redirects, not blank screens.

mobile journey — CREATE apps/mobile/.maestro/journeys/login-lesson-offline.yaml:
  login (seeded learner) → open today's lesson → answer one beat → enable airplane mode →
  answer another beat (queued) → disable airplane mode → assert queue drains (expose a
  testID'd sync indicator from the offline banner if none exists — EDIT the component, do not
  fake it). Runnable locally via `maestro test`; wire into .github/workflows/mobile-build.yml
  as a job on an Android emulator runner.

CI:
EDIT .github/workflows/ci.yml: add a blocking `journeys` job: compose up → seed → run
  e2e/specs/journeys + apps/web-admin/e2e with --workers=1 → upload traces/screenshots on
  failure → compose down. Budget ≤ 20 min; if slower, shard by app, never mark
  continue-on-error.

No-placeholder rule applied to tests: no test may stub the service under test; mocking is
  allowed ONLY at true third-party boundaries (Stripe, push gateways, LLM providers) using the
  patterns already present in tests/integration.

Acceptance:
  pnpm e2e journeys suite green locally against docker-compose.e2e.yml
  New CI job visible and blocking on the PR itself (the PR's own checks prove it)
  Failure artifacts (trace + screenshot) verified by forcing one failure in a scratch commit,
  then reverting it
```

### Sprint A8 — Per-user timezone end-to-end + live-reactive accessibility preferences

```
Goal: every rendered date/time respects the viewer's timezone (not America/New_York), and an
accessibility preference change applies everywhere within seconds without reload.

Timezone:
CREATE packages/db migration: add timezone (IANA string, nullable) to the user settings/profile
  table used by identity-svc; expose it through the profile read/update routes and the session
  snapshot (EDIT apps/web-v2/lib/auth/identity-session.ts claims schema + the BFF profile
  endpoints).
CREATE apps/web-v2/components/tz-sync.tsx: tiny client component mounted in app/layout.tsx;
  on first authenticated load, if Intl.DateTimeFormat().resolvedOptions().timeZone differs from
  the stored profile timezone (or none is stored), PATCH the profile once (debounced; respect
  an explicit user-chosen value by never overwriting a manually-set one — add tzSource:
  "auto"|"user" to the profile field).
EDIT apps/web-v2/lib/i18n/request.ts: replace the hardcoded timeZone: "America/New_York" with
  the session profile timezone, falling back to the tenant default, then UTC. Thread the same
  value into every explicit date formatter (grep toLocaleDateString/toLocaleTimeString/
  Intl.DateTimeFormat across apps/web-v2 and apps/web-admin and pass timeZone).
EDIT settings UIs: parent settings (web-v2) and web-admin account settings get a timezone
  picker (searchable IANA list, i18n labels) writing tzSource:"user".
Mobile reads the same profile field for any server-formatted strings; device-local formatting
  already uses the OS timezone.
EDIT apps/web-admin/lib/report-window.ts (from Sprint A1): compute window boundaries in the
  tenant timezone.
Tests: unit tests for the resolution chain (user > tenant > UTC) and the no-overwrite rule;
  e2e: set profile tz to Asia/Tokyo → schedule page shows JST times (assert formatted output).

Live-reactive accessibility preferences:
Today a preference saved on one surface requires reload elsewhere. EDIT the web-v2
  accessibility/sensory provider (the SensoryModeProvider + the a11y settings source under
  apps/web-v2/components/ / app/settings/accessibility/) to:
  (a) re-fetch the accessibility profile on window focus and on a BroadcastChannel
      ("aivo-a11y") message posted by the settings mutation,
  (b) apply changes by updating the existing data-* attributes/CSS vars in place.
EDIT the settings save action to post the BroadcastChannel message after a successful PATCH.
Mobile: EDIT the settings save path to update the in-memory accessibility context immediately
  after persistence succeeds (optimistic apply with rollback on failure) so no app restart is
  needed.
EDIT scripts/a11y/no-inert-prefs.mjs expectations if it tracks application points, so the gate
  still proves every preference is applied.
Tests: web e2e — change "reduced motion" in settings in tab A, assert tab B's <html> attribute
  flips without reload (two-page Playwright context); mobile unit test for optimistic
  apply/rollback.

Acceptance:
  pnpm a11y:audit && pnpm a11y:no-inert-prefs → green
  Timezone unit + e2e tests green; zero remaining hardcoded "America/New_York" (grep)
  pnpm release:gate → green
```

---

# Track B — Enterprise readiness

### Sprint B1 — OIDC single sign-on end-to-end (Okta + Microsoft Entra)

```
Goal: a district can sign its staff and teachers in via Okta or Entra ID using OIDC
authorization-code + PKCE, configured per-tenant from the admin console. SAML remains; OIDC is
the new first-class path.

Provider core:
REFACTOR packages/sso: today src/index.ts only wraps @node-saml/node-saml.
CREATE packages/sso/src/oidc.ts implementing, with `jose` and `openid-client` (add as deps):
  discovery (issuer metadata fetch + cache), buildAuthorizationUrl (state + nonce + PKCE S256),
  handleCallback (code exchange, ID-token signature/nonce/aud/iss verification, clock skew
  tolerance), and refresh. Export typed OidcConnectionConfig. Re-export from src/index.ts.
  Unit tests against a local mock provider (oauth2-mock-server as devDependency): happy path,
  tampered nonce, wrong audience, expired token, PKCE downgrade attempt — all rejected.

Per-tenant connection storage:
CREATE packages/db migration tenant_sso_connections: tenantId, type ('oidc'|'saml'), issuer,
  clientId, encrypted clientSecret (use the packages/security encryption helpers), claim
  mappings (role claim path + value→Role map, email/name claims), allowed email domains,
  enabled. CRUD routes in the owning identity service (services/identity-svc) restricted to
  platform_admin + the owning district_admin, with audit events on every change.

Login flows:
web-v2: CREATE app/(auth)/sso/[tenantSlug]/route.ts (start) and
  app/(auth)/sso/callback/route.ts: resolve the tenant connection, run the PKCE flow
  (httpOnly state/PKCE cookies, sameSite=lax, 10-min TTL), then JIT-provision/attach the user
  in identity-svc (matching the existing identity handshake so the session cookies set in
  lib/auth/identity-client.ts are identical to password logins — same cookies, same claims).
  EDIT the login page to add "Continue with your school account" entering by email-domain
  lookup or tenant slug.
web-admin: same start/callback pair under app/login/sso/, honoring its MFA policy decision:
  if the connection sets skipLocalMfa (IdP enforces MFA), bypass local MFA; otherwise chain
  into the existing MFA challenge. Persist that flag on the connection.
EDIT apps/web-v2/lib/env.ts: extend AUTH_MODE union with "oidc" admitted in production; when
  no per-tenant connection matches, fail with a clear error page — never fall through to
  another auth path.

Admin configuration UI:
CREATE apps/web-admin/app/platform/tenants/[id]/sso/page.tsx: configure issuer/clientId/secret/
  claim mappings, with a "Test connection" server action performing live discovery + a dry-run
  authorization URL build, surfacing errors via the Sprint A2 error-code pattern.

Regression guard + docs:
EDIT scripts/auth-mode-audit.mjs: extend its guard rules to the new OIDC modules (state/nonce/
  PKCE must be enforced — assert the verification calls exist; mock-mode rules apply to any
  new dev fixtures).
CREATE docs/auth/oidc-runbook.md: exact Okta and Entra app-registration steps (redirect URIs,
  claims, group→role mapping) with the staging verification recorded for BOTH providers.

Acceptance:
  pnpm --filter @aivo/sso test → green incl. negative cases
  Integration test suite (tests/integration) covering callback → session-cookie parity with
  password login
  pnpm auth:audit && pnpm release:gate → green
  Staging walkthrough vs real Okta dev tenant + Entra dev tenant recorded in the runbook
```

### Sprint B2 — Tenant-scoped feature flags with kill switches and an admin UI

```
Goal: a flag can be ON for one pilot district and OFF for the rest of production, flipped from
the admin console without a deploy, with an env-level kill switch that wins over everything.

Resolution core:
CREATE packages/db migration tenant_feature_overrides: tenantId, flagKey, enabled, updatedBy,
  updatedAt, unique(tenantId, flagKey).
REFACTOR packages/feature-flags:
  - Keep resolveEnterpriseFlags(env) as the environment DEFAULTS layer (unchanged contract).
  - CREATE src/tenant-flags.ts: createTenantFlagResolver({ defaults, store, killSwitches })
    returning resolveForTenant(tenantId) with precedence
    KILL (env AIVO_KILL_<FLAG>=1 forces OFF) > tenant override > env default,
    a 30s in-memory TTL cache, and an invalidate(tenantId) hook. The store is an injected
    interface; CREATE the drizzle-backed implementation in packages/feature-flags/src/store-db.ts
    (the package may depend on @aivo/db like its peers).
  - Unit tests: full precedence matrix, cache TTL + invalidation, unknown flag rejection.

Serving flags to every surface:
web-v2: CREATE app/api/bff/flags/route.ts returning the resolved flag map for the session's
  tenant (requireSession; no tenant = env defaults). EDIT the places web-v2 currently reads
  enterprise flags from env at request time (grep resolveEnterpriseFlags/AIVO_FEATURE_ across
  apps/web-v2 and refactor each call site) to resolve per-tenant via the new resolver.
web-admin: gate district-enterprise surfaces through the same resolver (grep its flag reads).
mobile: EDIT the app boot/config fetch to GET the BFF flags endpoint after login and expose a
  useFlags() hook; flags affecting navigation re-evaluate on auth change.
services: where a backend service consults an enterprise flag for a tenant-scoped request,
  inject the same resolver package rather than process.env (sweep services/ for AIVO_FEATURE_
  reads and convert the request-scoped ones).

Admin UI + audit:
CREATE services/admin-svc route PATCH /tenants/:tenantId/flags/:flagKey (platform_admin only)
  writing the override, emitting an audit event (admin.flag.changed with old/new), and calling
  invalidate(tenantId).
CREATE apps/web-admin/app/platform/tenants/[id]/flags/page.tsx: table of all flags from the
  registry with three-state display (env default / overridden ON / overridden OFF), toggle +
  "clear override" server actions, and the change history read from the audit log.

Regression guard:
CREATE scripts/feature-flag-audit.mjs: asserts every flag in the registry has a description +
  default, no raw process.env.AIVO_FEATURE_ reads outside packages/feature-flags, and kill-switch
  precedence is covered by a test. Register in release-gate + production-gates.yml.

Acceptance:
  Precedence + cache unit tests green; integration test: override for tenant A changes
  /api/bff/flags for A and not B within one TTL window
  Audit event row visible on the flags page after a toggle (e2e)
  pnpm release:gate → green including the new audit
```

### Sprint B3 — Admin data tables v2: real pagination, sort, search, and audited CSV export

```
Goal: a 50,000-learner district can browse, search, and export its data from web-admin. The
200-row snapshot pattern is retired on the highest-traffic tables: Audit Log, Users, Learners.

API layer:
EDIT packages/admin-api/src/audit.ts and identity.ts (listAdminAuditLogs, the users and
  learners list functions): change signatures to ({ cursor?, limit=50 (max 200), sort?, q?,
  filters? }) returning { rows, nextCursor, total? }. EDIT the corresponding admin-svc routes
  to implement keyset pagination in SQL (ORDER BY createdAt DESC, id DESC with a composite
  cursor), ILIKE search on the documented columns, and whitelisted sort keys. DELETE every
  hardcoded `, 200)` call-site cap (grep ", 200)" across apps/web-admin/app).
CREATE export endpoints in admin-svc: GET /…/export.csv streaming the SAME filtered query
  (cursor-batched, RFC 4180 escaping, BOM for Excel), hard server cap 100k rows with a clear
  413-style error beyond it. EVERY export emits an audit event (admin.data.exported: actor,
  table, filters, rowCount) BEFORE streaming begins.

UI layer:
CREATE packages/admin-ui/src/data-table/: a server-driven DataTable (column defs, sort
  headers with aria-sort, debounced search input, cursor pager with page-size select, CSV
  export button hitting the export endpoint, loading skeleton rows, empty + error states via
  the existing EmptyRow pattern). Server-component-friendly: state lives in URL searchParams
  so pages stay thin server components (matching the ADMIN_MIGRATION.md architecture).
REFACTOR apps/web-admin/app/platform/audit/page.tsx, the users list page, and the learners
  list page to consume it. EDIT apps/web-admin/components/admin-tables.tsx: DELETE the
  superseded static table components for these three tables once migrated (leave the others
  for a later pass — but no dead exports).

Tests:
admin-svc integration tests: cursor stability under concurrent inserts, search, sort
  whitelist rejection, export streams full filtered set + emits the audit event.
web-admin e2e (suite from Sprint A7): seed 500 audit rows → paginate past 200 → search narrows
  → export downloads a CSV whose row count matches → audit page shows the export event.

Acceptance:
  No remaining `, 200)` list caps on the three tables (grep proves it)
  pnpm --filter @aivo/web-admin typecheck/test green; admin e2e green
  Export audit event verified in e2e
```

### Sprint B4 — Audit sensitive READS and give districts an audit export with chain verification

```
Goal: "who viewed this child's data, when" is answerable in-product, and a district can export
its audit trail and verify integrity — the FERPA/SOC2 answer enterprise reviewers ask for.

Event schema first:
CREATE packages/audit-client/src/schema.ts: Zod schema for the canonical audit event shape
  (mirroring src/event.ts chain fields) + a validated emit wrapper; EDIT emit.ts so every emit
  validates before send (fail loudly in dev, log+drop-never in prod — invalid events still emit
  with a schema_violation marker so nothing is silently lost). Unit tests.

Read auditing (server components, where the data is fetched):
EDIT the sensitive detail pages to emit read events via the validated client:
  - apps/web-admin/app/platform/users/[id]/page.tsx → admin.user.viewed
  - the platform + district learner detail pages → admin.learner.viewed
  - the DSAR detail view → admin.dsar.viewed
  Include actor, resource id, tenant; NO content fields (respect the redaction taxonomy in
  docs/audit-event-taxonomy.md — IEP/medical/free-text never in metadata).
CREATE packages/audit-client/src/read-dedupe.ts: per (actor, resource) 5-minute in-memory
  dedupe so a refresh doesn't spam the trail; covered by unit tests. Document the dedupe
  window in the audit taxonomy doc.

District-facing export + verification:
EDIT services/audit-svc: add GET /audit/export (tenant-scoped, filterable by date range/action,
  CSV + JSONL, streamed, itself audited as audit.exported) and GET /audit/verify?from=&to=
  recomputing the hash chain over the range server-side and returning { intact: boolean,
  brokenAt? }.
CREATE apps/web-admin/app/district/audit/export/page.tsx (and surface the same on the school
  audit page where scoped): date-range picker, action filter, export buttons, and a "Verify
  integrity" action rendering the verification result with a plain-language explanation of
  hash chaining. All staff actions here use the Sprint B3 DataTable for the preview list.

Tests:
audit-svc: verify() detects a tampered fixture row; export emits its own audit event;
  tenant isolation (district A cannot export B).
web-admin e2e: view a user detail → audit table shows admin.user.viewed exactly once within
  the dedupe window; export downloads; verify shows intact.

Acceptance:
  pnpm --filter @aivo/audit-client test && pnpm --filter @aivo/audit-svc test → green
  e2e green; docs/audit-event-taxonomy.md updated with the new read events
  pnpm release:gate → green
```

### Sprint B5 — SCIM 2.0 provisioning (Okta/Entra roster sync)

```
Goal: a district connects Okta or Entra SCIM provisioning and users are created, updated,
deactivated, and grouped in AIVO automatically — no more manual CSV cycles. CSV/SIS import
remains; both paths converge on ONE roster-apply core.

Shared roster core (refactor before adding the second producer):
REFACTOR the existing CSV/SIS import application logic in services/integration-svc into
  src/roster/apply.ts: pure functions applyUserUpsert / applyUserDeactivate / applyGroupMembership
  that both the CSV path and SCIM call, emitting the same roster-change events. The CSV path
  must end this sprint calling the shared core (no parallel duplicate logic left).

SCIM endpoints (in services/integration-svc):
CREATE src/routes/scim.ts implementing SCIM 2.0 for /scim/v2:
  - GET /Users with filter (userName eq, externalId eq), startIndex/count pagination, and
    proper ListResponse envelopes
  - POST /Users (JIT create mapped to role via the connection's default role + group rules)
  - GET/PATCH /Users/:id (PatchOp; active:false → deactivate via the shared core — never
    hard-delete; emails/name updates applied)
  - DELETE /Users/:id → deactivate (document the soft-delete semantics in the response)
  - GET/POST/PATCH /Groups mapping to classes/sections per the district-enterprise model
    (group displayName conventions documented; unmapped groups recorded, surfaced in the UI,
    and skipped — explicitly NOT silently dropped)
  - /ServiceProviderConfig, /ResourceTypes, /Schemas discovery documents matching what is
    actually implemented (no advertised features that 501).
Auth: CREATE packages/db migration tenant_scim_tokens (tenantId, hashed token, createdBy,
  lastUsedAt, revokedAt); bearer-token middleware resolves the tenant and scopes every
  operation to it. 404-vs-403 behavior per spec.

Admin UI:
EDIT apps/web-admin district SIS/rostering pages: add a SCIM section — generate token (shown
  once), revoke, lastUsedAt, per-resource sync counters, and the unmapped-groups review list.
  Token generation/revocation emit audit events.

Conformance tests:
CREATE integration tests driving the endpoints with recorded Okta and Entra request shapes
  (their documented SCIM payloads): create → update → deactivate → reactivate lifecycle,
  filter paging, group membership add/remove, wrong-tenant token isolation, malformed PatchOp
  rejection. EDIT scripts/rostering-audit.mjs to recognize and require the SCIM path.
CREATE docs/integrations/scim-runbook.md with the exact Okta + Entra provisioning app setup,
  attribute mappings, and the staging verification recorded against at least one real IdP
  dev tenant.

Acceptance:
  pnpm --filter @aivo/integration-svc test → green incl. SCIM lifecycle suite
  pnpm rostering:audit && pnpm release:gate → green
  CSV import regression suite still green (shared core proves single-path)
  Runbook contains a recorded end-to-end sync from a real IdP dev tenant
```

### Sprint B6 — White-label theming MVP (per-tenant logo, palette, support link)

```
Goal: a district sees its own logo and accent palette across web-v2, web-admin, and mobile
post-login surfaces — with WCAG contrast enforced so white-labeling can never degrade
accessibility. (Custom domains are explicitly out of scope this sprint; note that in the doc.)

Storage + management:
CREATE packages/db migration tenant_branding: tenantId (unique), logoUrl, primaryColor,
  secondaryColor, supportUrl, updatedBy/updatedAt.
EDIT services/admin-svc: CRUD routes (platform_admin always; district_admin self-serve gated
  behind the districtEnterpriseMode flag via the Sprint B2 resolver), logo upload through the
  existing identity-svc S3 proxy pattern (proxied GET, size/type limits, SVG sanitized or
  rejected — prefer PNG/JPEG only to avoid SVG script risk), audit events on change.

Contrast enforcement (this is the IDEO-grade detail):
CREATE packages/brand/src/contrast-guard.ts: validate that the chosen primary/secondary meet
  WCAG AA (≥4.5:1) against the brand's text/surface tokens in BOTH light and dark themes,
  returning specific failures ("primary on surface fails: 2.9:1"). The admin-svc write route
  rejects failing palettes with those messages; the UI previews live contrast results before
  save. Unit tests with passing and failing fixtures.

Web injection:
CREATE apps/web-v2/lib/branding.ts: server helper fetching the session tenant's branding
  (cached per request) → EDIT app/layout.tsx to set CSS custom properties for the small,
  fixed set of brand override vars and pass logoUrl into the app shell header slot (EDIT the
  shell component under packages/ui or apps/web-v2/components that renders the wordmark; it
  falls back to the AIVO mark when no branding exists). The override surface is ONLY:
  header logo, primary/secondary accent vars, support link in help menus + error pages.
  Learner sensory palettes (playful/calm) are NOT overridable — document why (clinical
  consistency for neurodiverse learners) in docs/design/white-label.md.
Mirror minimal injection in web-admin (district/school shells show the district logo).

Mobile:
EDIT the post-login bootstrap to fetch branding via a new GET /api/bff/branding (web) /
  equivalent mobile endpoint; apply logo + accent to role-shell headers via the existing
  theme context. Pre-auth screens remain AIVO-branded (no tenant known yet) — by design,
  documented.

Admin UI:
CREATE apps/web-admin/app/platform/tenants/[id]/branding/page.tsx: upload logo, pick colors
  (with live contrast verdicts from contrast-guard), set support URL, preview card, reset to
  default. District self-serve variant on the district settings page behind the flag.

Tests + guards:
e2e (A7 stack): seed two tenants with different branding → assert each renders its own logo
  and CSS vars post-login; tenant without branding renders AIVO defaults.
Contrast guard unit tests; admin-svc route tests (RBAC, flag gating, reject bad palette).
pnpm brand:check must stay green (defaults untouched).

Acceptance:
  Two-tenant e2e proves isolation; contrast rejection proven by test
  pnpm release:gate → green
  docs/design/white-label.md documents scope, the non-overridable learner palettes, and the
  custom-domain exclusion
```

### Sprint B7 — Performance and design-system guardrails (budgets, tokens, living Storybook)

```
Goal: performance and visual consistency stop regressing silently: Lighthouse + bundle budgets
block CI, design tokens have ONE source feeding all four theme implementations, and a living
Storybook documents the component library.

Lighthouse + bundle budgets:
CREATE .github/workflows/web-vitals-budgets.yml (blocking on PRs touching apps/web-v2 or
  packages/ui): build web-v2, start with AUTH_MODE=mock (same as bff-integration), run
  @lhci/cli against /, /login, /learner/home, /parent/home with assertions LCP ≤ 2.5s,
  CLS ≤ 0.1, TBT ≤ 300ms (lab), a11y score ≥ 95. No continue-on-error.
EDIT .github/workflows/marketing-lighthouse.yml: remove continue-on-error so the existing
  marketing run also enforces.
EDIT apps/web-v2/next.config.ts: wire @next/bundle-analyzer behind ANALYZE=1.
CREATE scripts/ci/bundle-budget.mjs: parse the build output and fail if any route group's
  first-load JS exceeds budgets committed in scripts/ci/bundle-budgets.json (seed budgets from
  today's ~97 kB shared baseline + per-group sizes, +10% headroom). Add as a step after the
  web-v2 build in ci.yml.

One token source (consolidate, do NOT merge packages):
REFACTOR packages/brand: move the canonical values from src/inclusive-warm.ts /
  playful-calm.ts / role-themes.ts into DTCG-format JSON under packages/brand/tokens/
  (color, space, radius, motion, type) and CREATE a build step (src/generate.ts run via the
  package build) that emits the EXISTING TypeScript exports from the JSON — consumers keep
  compiling unchanged. The JSON is now the only place a designer edits a value.
EDIT packages/learner-ui (playful-calm-modes.ts, sensory-vars.ts), packages/mobile-ui
  (theme.ts, tierTheme.ts), and packages/stage-ui theme files: replace locally re-derived
  constants with imports from @aivo/brand's generated outputs. DELETE the duplicated literal
  token values from those files (grep hex literals to verify none remain outside
  packages/brand/tokens). Visual baselines from Sprint A1 must not change — that is the
  refactor's proof of equivalence.
CREATE scripts/design-token-audit.mjs: fails on raw hex color literals in packages/{ui,
  learner-ui,admin-ui,mobile-ui,stage-ui}/src outside generated files. Register in
  release-gate + production-gates.yml (seed an allowlist only for genuinely non-token colors,
  each with a justification comment).

Living Storybook:
DELETE packages/learner-ui/storybook-static/ (stale build artifact in git).
CREATE a single Storybook workspace at packages/storybook (or extend learner-ui's config to
  aggregate) with stories for the top 20 shared components across @aivo/ui, @aivo/learner-ui,
  @aivo/admin-ui (buttons, KpiCard, charts, DataTable from B3, shell, stage beats, consent
  sheet), the @storybook/addon-a11y panel enabled, and theme/sensory-mode toolbar switching
  (playful/calm, light/dark/high-contrast). Each story uses real components — no
  lorem-ipsum-only stories for stateful components; wire realistic props/fixtures.
EDIT root package.json storybook:build to point at the aggregate; EDIT ci.yml to build it on
  PRs touching packages/* and upload as an artifact.

Coverage ratchet:
EDIT vitest configs of apps/web-v2, apps/web-admin, apps/mobile: enable v8 coverage with
  thresholds set ~2 points BELOW current measured values (measure first, then commit), so the
  gate ratchets up without blocking today. Record current numbers in the PR description.

Acceptance:
  New Lighthouse + bundle jobs visibly blocking on the PR; budgets file committed
  Visual baselines unchanged after token consolidation (Playwright proves it)
  pnpm storybook:build succeeds; artifact uploaded in CI
  pnpm release:gate → green including the token audit
```

---

## Dispatch order & dependency notes

| Order | Sprint | Depends on | Unlocks |
| --- | --- | --- | --- |
| 1 | A1 | — | trustworthy gates for everything after |
| 2 | A2 | — | crash visibility before any beta traffic |
| 3 | A3 | A2 (Sentry origin in CSP connect-src) | ZAP issues closed; enterprise security answers |
| 4 | A4, A5 | — (parallel) | store submission path |
| 5 | A6 | A5 (store metadata references age gate) | COPPA-complete onboarding |
| 6 | A7 | A1 (real baselines), A3 (CSP enforced in suite) | blocking journey safety net |
| 7 | A8 | A7 (journeys assert tz/a11y reactivity) | **USER PRODUCTION LAUNCH GATE** |
| 8 | B1 | A3 | district SSO pilots |
| 9 | B2 | — | per-district pilots & kill switches |
| 10 | B3 | A7 (admin e2e harness) | district-scale operations |
| 11 | B4 | B3 (DataTable), audit schema | FERPA/SOC2 reviewer answers |
| 12 | B5 | B2 (flag-gated), roster core refactor | automated rostering RFP line |
| 13 | B6 | B2 (flag-gated), A1 baselines | white-label RFP line |
| 14 | B7 | A1 baselines | **ENTERPRISE READINESS GATE** |
