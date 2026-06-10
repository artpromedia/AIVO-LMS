# Frontend Production & Enterprise Readiness Review — 2026-06-10

**Scope:** `apps/web-v2` (user web), `apps/web-admin` (internal/district admin), `apps/mobile` (Expo), `apps/marketing`, plus the shared frontend packages (`ui`, `learner-ui`, `admin-ui`, `mobile-ui`, `stage-ui`, `brand`, `accessibility-contract`, `feature-flags`, `sso`, `enterprise-core`, `audit-client`).
**Method:** every claim below is backed either by a command run on this checkout (exit codes noted) or a file/line citation. Where a finding contradicts an earlier internal doc, the contradiction is called out.

---

## 1. Executive summary

| Surface | Scale | Verdict | Confidence |
| --- | --- | --- | --- |
| **web-v2** (parent/learner/teacher/caregiver/therapist) | 137 pages, 900 TS files | **Nearly ready** — blocked on observability, CSP/CSRF hardening, e2e depth | High |
| **web-admin** (platform/district/school staff) | 79 pages, 114 TS files | **Nearly ready** — blocked on observability, ZAP findings, table pagination | High |
| **mobile** (Expo, all roles) | 146 screens, 314 TS files | **Not store-submittable yet** — missing crash reporting, error boundary, iOS privacy manifest, store assets, a11y label coverage | High |
| **marketing** | 44 routes incl. pricing, trust, subprocessors | **Ready** (strongest surface) | Medium-high |
| **Enterprise layer** (SSO, flags, audit, white-label) | — | **Mid-market ready; not RFP-ready for large districts** | High |

**The headline:** this is a far healthier codebase than most pre-launch products. Typecheck is clean on both web apps, 338/338 mobile unit tests and 36/36 admin tests pass, i18n parity is 100% across 10 locales, there are 43 CI workflows including 20 self-built production gates, zero TODO debt, and compliance UX (consent, DSAR export/delete, COPPA/FERPA pages) is genuinely built. The remaining gap is not "finish the product" — it is **(a) you cannot see production** (no client-side error tracking on any surface), **(b) security headers/CSRF confirmed missing in live ZAP scans**, **(c) mobile store logistics**, and **(d) four enterprise features districts will ask for in RFPs** (OIDC, SCIM, per-tenant flags, white-labeling).

---

## 2. Evidence run on this checkout (2026-06-10)

| Check | Result |
| --- | --- |
| `pnpm release:gate` (20 sub-gates) | **19/20 PASS — `auth:audit` FAILS** (regression since the green 2026-06-03 signoff) |
| `pnpm auth:audit` detail | `apps/web-v2/lib/auth/mock-session.ts` — `readMockSessionFromCookies` / `getMockSession` don't literally call `mockAuthAllowed()`. **Not exploitable** (both delegate to base readers that guard at lines 141/149) but the gate is rightly strict; per policy "do not deploy" until green. |
| `pnpm prod:check` | Passes, but flags `services/tutor-svc/src/modes/lifeSkillsTutor.ts` coverage matrix scaffold — becomes a **blocker when `NODE_ENV=production`**. |
| `pnpm i18n:coverage` | 10 locales (en/es/fr/de/pt/zh/ja/ko/ar/hi), 0 missing keys, 0 orphans across web-v2, marketing, mobile (896 keys), i18n-svc |
| `tsc --noEmit` web-v2 / web-admin | Clean / Clean |
| `pnpm --filter @aivo/mobile test` | 38 files, **338/338 pass** |
| `pnpm --filter @aivo/web-admin test` | 5 files, **36/36 pass** |
| `pnpm --filter @aivo/web-v2 build` (CI env: `AUTH_MODE=mock AIVO_TEST_MODE=1`) | **Succeeds (exit 0)** — shared first-load JS ≈97.1 kB (healthy) |
| Visual regression baselines | **All 4 committed baselines in `apps/web-v2/e2e/visual-a11y.playwright.ts-snapshots/` are blank white 1280×720 images (identical 4,254 bytes).** The screenshot assertions guard nothing. `screenshots/design-language/*-after.png` are also blank. |
| Open GitHub issues | #65 ZAP scan vs admin.aivolearning.com (**labeled release-blocker**), #73 ZAP vs district.aivolearning.com, #68/#69 vitest CRITICAL advisory (GHSA-5xrq-8626-4rwp) keeping `security-scan.yml` red |

### Production ZAP scans confirm the code-level security gaps

Issues #65 (2026-05-31) and #73 (2026-06-07), generated against **live production domains**:

- **CSP header not set** — confirmed: no CSP in `apps/web-v2/next.config.ts` or `apps/web-admin/next.config.ts`
- **Anti-CSRF tokens absent** on login/forgot-password forms — `sameSite: "lax"` (set correctly in `apps/web-v2/lib/auth/session-cookies.ts:36-38`) is the only mitigation
- **`X-Powered-By` leaking** — `poweredByHeader: false` not set in either Next config
- **COOP / COEP / CORP missing**, **SRI missing**
- **Cookies without HttpOnly/Secure flags** on admin `/` and `/login` — session cookies are hardened in code, so this is likely a secondary cookie (locale/CSRF-less form cookie); needs identification
- **"User Controllable HTML Element Attribute (Potential XSS)"** on `admin/login` — likely the `?next=` param; needs manual verification
- HSTS/X-Content-Type-Options missing on `robots.txt` (static files bypass the `headers()` matcher)

---

## 3. Per-surface findings

### 3.1 web-v2 — the user product

**Strengths (verified):**
- 137 pages across 11 persona route groups; no placeholder pages; dev-only routes (`/design-system`, `/surface-preview`, fixtures) blocked in prod middleware
- Error handling done right: `app/error.tsx` with stale-server-action auto-recovery, `global-error.tsx`, role-scoped error boundaries, standardized BFF envelope (`{ ok, data/error, requestId }`) with request-ID correlation
- Auth: dual-source session (verified JWT + httpOnly snapshot), tenant isolation + role/permission guards on every BFF route (`lib/bff/guards.ts`), env validator **refuses mock auth and in-memory persistence in production** (`lib/env.ts:30-77`), SESSION_SECRET length/placeholder checks
- Accessibility: skip link, RTL `dir` on `<html>`, Atkinson Hyperlegible dyslexia font, sensory modes (playful/calm), 29 reduced-motion references, 220 ARIA attributes, axe e2e specs tagged `@a11y`
- Offline: service-worker outbox with IndexedDB queue and auto-drain (`components/offline/offline-banner.tsx`)
- Hygiene: 0 TODO/FIXME, ~3 `any`-casts, 2 `console.log` (seed script only)

**Gaps (ranked):**
1. **No client-side error tracking or web-vitals reporting** — pino server logs only. A broken learner session is invisible to you.
2. **E2E journey coverage thin** — strong BFF/contract specs, but only ~2 true user-journey specs; no parent-onboarding→consent→baseline→lesson loop.
3. **Visual regression baselines are blank** (see §2) — regenerate or delete; right now they are false confidence.
4. **No CSP; CSRF tokens absent** (ZAP-confirmed; `lax` cookies mitigate but enterprise security reviews will flag it).
5. Timezone hardcoded to `America/New_York` (`lib/i18n/request.ts:17`) — wrong session times for any non-Eastern district.
6. No bundle analysis / dynamic-import strategy (route-split only).
7. Accessibility preferences don't re-render live across surfaces after change.

### 3.2 web-admin — staff & district console

**Strengths (verified):**
- 79 pages, 8 personas, **zero mock data** (ADMIN_MIGRATION.md Wave 16 complete; every page is a thin server component over `admin-api`)
- Defense-in-depth RBAC: middleware role check → layout `requirePageRole()` → JWT/cookie cross-check (`packages/admin-auth/src/server.ts:80-98`); MFA on login with 429 lockout handling; 15-min access tokens; hardened cookies (`httpOnly`, `sameSite: lax`, `secure` in prod)
- Dashboard panels degrade per-panel via `Promise.allSettled` — one failing backend doesn't blank the page
- Docker: multi-stage, non-root, healthcheck, standalone output

**Gaps (ranked):**
1. **Observability missing entirely** (no error tracking, no structured logs shipped anywhere).
2. **ZAP release-blocker #65 targets this app's domain** (headers, cookie flags, potential XSS on login `?next=`).
3. **Tables cap at 200 rows with no pagination/sort/search/CSV export** — fine for pilots, fails at district scale and fails "data portability" RFP lines.
4. **School dashboard queries a hardcoded date range** (`app/school/page.tsx:64-65`, `2024-09-01`→`2024-12-20`) — every school admin sees stale 2024 data today. Small fix, embarrassing bug.
5. Error redirects leak backend detail into URLs (`?error=DSAR request ID not found`).
6. Audit log covers mutations but **not sensitive reads** (who viewed a learner's PII) — gap for FERPA/SOC2 narratives.
7. No e2e at all for admin flows.

### 3.3 mobile — Expo app

**Strengths (verified):**
- 146 screens across 6 role groups, no stubbed routes; 338/338 unit tests green
- Production-grade auth: SecureStore tokens, single-flight 401 refresh, biometric unlock storing short-lived JWT behind OS keychain ACL, MFA, forced-password-change gate
- Offline queue with idempotency keys + 7-day TTL + authenticated replay; `networkMode: "offlineFirst"` defaults
- COPPA consent UX: non-dismissible parent consent sheet with separate school-share/AI/marketing toggles, child-approval gate
- Tablet/multitasking responsive system with 44dp touch targets; 10-locale i18n with parity test

**Blockers before store submission (ranked):**
1. **No crash reporting (no Sentry/Bugsnag) and no React error boundary** — a JS error mid-lesson crashes a child's session silently. This is the single highest-risk gap in the entire frontend.
2. **iOS Privacy Manifest (`PrivacyInfo.xcprivacy`) missing** — App Store enforcement since May 2024; submission will be rejected.
3. **Store screenshots directories empty** (`store-assets/screenshots/{ios,android}` are `.gitkeep` only); privacy-policy URLs not set in `app.json`/store config.
4. **`accessibilityLabel`/`accessibilityRole` coverage is sparse** (a handful of screens) — VoiceOver/TalkBack users can't navigate. For this product's audience this is a launch blocker, not a polish item.
5. **`SwitchScanOverlay` is wired with `items={[]}`** (`app/(learner)/_layout.tsx:65`) — switch-access AAC is rendered but non-functional.
6. Push notifications: permission priming exists, but no foreground/background notification handler or tap-routing.
7. Two separate offline queues (lib/offline-queue vs stage session outbox) with different retry semantics.
8. No explicit under-13 age gate before consent flow (COPPA verifiability).
9. EAS owner (`iamofemeofem`) unverified — run `eas whoami` before next build.
10. No e2e (Maestro/Detox) for login→lesson→session-end.

### 3.4 marketing

44 routes — pricing, demo, waitlist, blog, guides, six persona landing pages, compare pages, and the enterprise-sales set (`/trust`, `/security`, `/subprocessors`, `/press-kit`, COPPA/FERPA/privacy/cookie policies). Has its own a11y + Lighthouse + smoke-test workflows (Lighthouse is advisory/`continue-on-error`). **This surface is ready**; keep Lighthouse advisory→enforced as a fast follow. *(An earlier internal pass that called marketing "compliance pages only" was wrong — corrected here.)*

---

## 4. Cross-cutting & enterprise readiness

**Already strong (sellable today):**
- **Compliance UX**: parent privacy hub with DSAR export + deletion flows in-product (`app/parent/privacy/*`), consent ledger admin search, state-privacy matrix + privacy program docs, audit hash-chain in backend
- **Multi-tenancy & RBAC**: platform→district→school→class hierarchy (`packages/enterprise-core/src/tenant-context.ts`), granular `ROLE_PERMISSIONS`, impersonation guard with audited writes
- **i18n**: 10 locales at 100% key parity, enforced by 3 CI ratchets
- **Accessibility contract**: 17-preference shared schema (incl. AAC input methods, TTS voices, bounds) enforced by 3 CI gates including "no inert prefs"
- **Gate culture**: 20-gate `release:gate`, doc-vs-gate consistency checker so docs can't claim green falsely

**Enterprise gaps (what loses district RFPs, ranked):**
1. **SSO: SAML only** (`packages/sso` wraps node-saml) — **no OIDC wiring** (Okta/Entra/Google Workspace standard); Clerk/AuthJS modes are declared in env but not integrated.
2. **No SCIM provisioning** — roster sync is CSV/SIS-import only; large districts expect SCIM 2.0.
3. **Feature flags are env-scoped, not tenant-scoped** (`packages/feature-flags/src/enterprise-flags.ts` — 11 flags, all `AIVO_FEATURE_*` env vars, default OFF). No per-district pilots, canaries, or kill switches.
4. **No white-labeling** — no per-tenant logo/palette injection anywhere in `packages/brand`.
5. **No client-side observability story** to put in a security/ops questionnaire (also items #65/#68: keep ZAP and `pnpm audit` green or documented).
6. **Audit trail for reads** absent (see §3.2) and no district-facing audit export/verification UI.
7. **Design system fragmentation**: 145 components across 5 packages, 4 theme implementations re-deriving token math; only learner-ui has (a stale, static) Storybook. Slows every enterprise UI request.
8. **No Lighthouse/coverage thresholds enforced** anywhere in blocking CI.
9. 37 canonical brand assets missing (favicons/splash/logo variants) — flagged NEEDS-HUMAN in the 2026-06 signoff, still outstanding.
10. Mobile store presence (see §3.3) — districts increasingly require iOS/Android parity in RFPs.

---

## 5. The plan

Phasing principle: **first see reality (observability + truthful tests), then harden trust (security/a11y/store), then sell upward (enterprise features)**. Each item lists its acceptance gate — preferably one of the repo's own.

### Phase 0 — Stop the bleeding (this week, ~2-4 dev-days)

| # | Item | Acceptance |
| --- | --- | --- |
| 0.1 | Fix `auth:audit` regression: add explicit `mockAuthAllowed()` guard to the two wrappers in `mock-session.ts` | `pnpm release:gate` 20/20 PASS |
| 0.2 | Fix hardcoded school-report date range (`web-admin/app/school/page.tsx:64-65`) → rolling window | School dashboard shows current-term data |
| 0.3 | One-line header wins on both Next apps: `poweredByHeader: false`, add COOP/CORP, extend headers to static files | Next ZAP run drops those alert classes |
| 0.4 | Regenerate (or delete) blank visual baselines; make `test:a11y` + visual job a blocking PR check | Baselines show real pixels; CI red on regression |
| 0.5 | Resolve vitest CRITICAL (#68/#69) — upgrade to v4 or formally accept+suppress with rationale | `security-scan.yml` green on main |
| 0.6 | Verify EAS ownership (`eas whoami`), decide tutor-svc lifeSkills scaffold (author or attest) | `NODE_ENV=production pnpm prod:check` exits 0 |

### Phase 1 — See what users experience (weeks 1-2)

| # | Item | Acceptance |
| --- | --- | --- |
| 1.1 | **Sentry on all three app surfaces** (`@sentry/nextjs` ×2, `@sentry/react-native`), wired to release/commit SHA, PII-scrubbed (COPPA: no child identifiers in events) | Forced test error visible in Sentry from each surface |
| 1.2 | **Mobile error boundary** wrapping the router Stack + a stage-level boundary that preserves/queues session progress | Thrown render error shows friendly recovery screen, session outbox intact |
| 1.3 | Web-vitals reporting (Next `useReportWebVitals` → existing observability pipe) | LCP/CLS/INP visible per route |
| 1.4 | Sanitize `?error=` messages in web-admin (map to codes; details to server logs only) | No backend strings in URLs |

### Phase 2 — Trust hardening: security + accessibility + store (weeks 2-5)

| # | Item | Acceptance |
| --- | --- | --- |
| 2.1 | CSP (report-only → enforce; nonce-based, allow KaTeX/fonts), close ZAP #65/#73 incl. identifying the un-flagged cookie and the `/login?next=` reflection | ZAP baseline: 0 new alerts; issues closed |
| 2.2 | CSRF tokens (double-submit or Next server-action origin checks documented) for the enterprise checklist even with `lax` cookies | ZAP anti-CSRF alert cleared; security.md updated |
| 2.3 | **Mobile a11y sprint**: `accessibilityLabel`/`Role` on all interactive elements (lint rule `react-native-a11y` to ratchet), populate `SwitchScanOverlay` items from accommodations, VoiceOver/TalkBack pass on the 5 core learner screens | a11y lint gate green; manual SR script recorded |
| 2.4 | **Store pack**: `PrivacyInfo.xcprivacy`, screenshots (10 locales optional, EN minimum, per-resolution), privacy-policy/support URLs, Play data-safety form, notification tap-routing handler | TestFlight + Play internal track accepted |
| 2.5 | E2E critical journeys (web-v2: signup→consent→baseline→first lesson; parent reports; teacher assign→learner complete. web-admin: login+MFA→pilot provision→audit visible. mobile: Maestro login→lesson→offline replay) | New `e2e:journeys` job blocking in `ci.yml` |
| 2.6 | Explicit under-13 age gate step in mobile + web onboarding before consent sheet | consent:audit extended to assert age gate |
| 2.7 | Per-user timezone (profile field, default from browser/device) replacing hardcoded ET | Reports/schedules render in district tz |

### Phase 3 — Enterprise readiness (weeks 4-10, parallel tracks)

| # | Item | Acceptance |
| --- | --- | --- |
| 3.1 | **OIDC** end-to-end (`AUTH_MODE=oidc`: Okta + Entra ID tested; discovery, PKCE, JIT user mapping to roles) | District can SSO via Okta in staging; auth:audit extended |
| 3.2 | **Tenant-scoped feature flags**: flag service keyed on `TenantContext` (DB-backed overrides + env defaults; admin UI toggle per district; kill-switch path) | Pilot district gets a flag the rest of prod doesn't |
| 3.3 | **Admin tables v2**: cursor pagination, sort, search, CSV export — start with Audit Log, Users, Learners | 10k-row tenant browsable; export audited |
| 3.4 | **Audit for sensitive reads** + district-facing audit export with hash-chain verification note | "Who viewed learner X" answerable in UI |
| 3.5 | **SCIM 2.0** provisioning (users/groups, filtered list, soft-delete→deactivate) or an explicit "SIS-sync only" sales position paper | Okta SCIM integration test green, or signed positioning doc |
| 3.6 | **White-label MVP**: tenant branding record (logo, 2 palette slots, support URL) injected as CSS vars at request time; mobile reads same config | Demo district shows own logo/colors on web; RFP answer flips to yes |
| 3.7 | Observability story doc for RFPs (what's logged, where, retention, SIEM export) | Attached to /trust page |

### Phase 4 — Scale & polish (continuous after Phase 2)

- Design-system consolidation: one token source (DTCG JSON in `@aivo/brand`) consumed by all 4 theme implementations; shared Storybook with axe addon published per PR; dedupe motion/primitives between `ui`/`learner-ui`.
- Lighthouse CI budgets (learner home, lesson player, parent reports) as blocking checks; bundle-analyzer in web-v2.
- Coverage thresholds (start 60%, ratchet) on the 3 app workspaces.
- Brand asset completion (the 37 missing files — needs design, not engineering).
- Consolidate mobile dual offline queues; background sync.
- Live-reactive accessibility preferences across surfaces.

### Suggested sequencing & sizing

- **Gate to "user production ready" (consumer/pilot launch):** Phases 0-2 complete. Roughly 4-5 weeks with 2-3 frontend engineers + ~1 designer-week (store assets) + QA for the journey suite. Mobile a11y (2.3) and Sentry (1.1/1.2) are the long poles.
- **Gate to "enterprise ready" (district RFPs):** Phase 3. OIDC (3.1) and tenant flags (3.2) first — they unblock pilots; SCIM (3.5) and white-label (3.6) can trail by a sprint. Roughly +4-6 weeks in parallel tracks.
- Keep the existing release-gate discipline: every new capability above should land with its own audit script or extend an existing one, mirroring `production-gates.yml`.

---

## 6. What NOT to spend time on now

- Rewriting/merging the 5 UI packages into one — consolidate tokens first (Phase 4), defer package merges.
- More custom audit scripts — the 20 you have are excellent; invest in the missing *runtime* signals (Sentry, journeys, Lighthouse) instead.
- Web-admin visual polish — its information architecture is sound; pagination/export matter more than aesthetics for staff tools.
- District portal on mobile — the README's web-only decision is right; keep it.

---

*Build addendum:* `pnpm --filter @aivo/web-v2 build` completed successfully on this checkout (exit 0, standalone output, ≈97.1 kB shared first-load JS); typecheck independently clean for web-v2 and web-admin.
