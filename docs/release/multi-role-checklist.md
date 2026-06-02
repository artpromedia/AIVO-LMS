# Multi-role release checklist

> ADR 0020 Phase 4 slice 4.7 — the release manager runs through this
> checklist before each App Store / Play Store / web production
> deploy. Every item must be checked, or the release waits until it is.

## 1. Single shell, single listing

- [ ] `pnpm shell:audit` passes (no new `apps/<role>` deployable).
- [ ] `corepack pnpm --filter @aivo/mobile run audit:single-listing`
      passes:
  - iOS bundle id `com.artpromedia.aivo`
  - Android package `com.artpromedia.aivo`
  - EAS profiles = `development`, `staging`, `production` (no per-role profile)
- [ ] `apps/web-v2` is the only authenticated Next.js deployable.
- [ ] `apps/marketing` CTAs point at the `apps/web-v2` auth flow
      (via `WEB_APP_URL`).

## 2. Mobile listing copy mentions all five roles

- [ ] `apps/mobile/store-assets/description.md` enumerates **Learner,
      Parent, Teacher, Therapist, Caregiver** and notes the
      school-admin surface.
- [ ] `apps/mobile/store-assets/keywords.txt` includes each role id.
- [ ] `apps/mobile/store-assets/whats-new.md` reflects the current
      release.
- [ ] Screenshots in `apps/mobile/store-assets/screenshots/{ios,
android}/*` cover the seven canonical frames listed in the
      screenshots README (role switcher → 5 role homes → cross-cutting
      notifications).
- [ ] App Store Connect / Play Console pulls copy **from this folder**,
      not from ad-hoc docs.

## 3. Universal & app links

- [ ] `apps/web-v2/public/.well-known/apple-app-site-association`
      lists the production bundle id (no `TEAMID` placeholder).
- [ ] `apps/web-v2/public/.well-known/assetlinks.json` has the
      production signing fingerprint (no `AA:BB:CC:…` placeholder).
- [ ] Both files cover `/learner/*`, `/parent/*`, `/teacher/*`,
      `/therapist/*`, `/caregiver/*`, `/notifications`, `/messages`,
      `/settings`, `/billing`, `/role-switch`.
- [ ] `node scripts/well-known-links-smoke.mjs https://aivo.app`
      passes against the prod deployment after release.
- [ ] `node scripts/well-known-links-smoke.mjs https://staging.aivo.app`
      passes against the staging deployment.
- [ ] Mobile `expo.ios.associatedDomains` includes
      `applinks:aivo.app` and `applinks:staging.aivo.app`.
- [ ] Mobile `expo.android.intentFilters` cover the same paths with
      `autoVerify: true`.

## 4. Per-role rollout flags

- [ ] `AIVO_ROLE_<ROLE>_ENABLED` env vars set per environment match the
      GTM plan for this release (e.g. therapist on in staging, off in
      production until launch day).
- [ ] `resolveRoleRolloutFlags("production", process.env)` snapshot is
      stored in the release ticket so a rollback can re-apply it.
- [ ] Dark-launched roles confirmed invisible in the role switcher on
      production builds (manual smoke).

## 5. Observability slicing

- [ ] At least one analytics event from each enabled role observed in
      the dashboard with the `activeRole` field populated.
- [ ] `availableRoles` slicing works in the role-aware Grafana
      dashboard.
- [ ] No log lines in the production sample contain a sensitive value
      that bypassed `safe-logger` (spot-check).

## 6. Backout plan

- [ ] Previous build numbers recorded for iOS and Android.
- [ ] Web previous deploy SHA recorded.
- [ ] Feature-flag override values recorded so the on-call can flip a
      role back to dark-launched without a redeploy.

---

## 7. Phase 5 — Hardening & policy (ongoing)

ADR 0020 Phase 5 — these gates run on **every** PR via the
`phase5-rbac-policy` CI job. The release manager confirms the latest
run is green; no per-release manual step is required when CI is.

- [ ] `phase5-rbac-policy` job is green on the release commit.
- [ ] No new `Role` or `NavArea` added without an explicit row in
      `permissions.ts` (matrix-coverage gate catches this) **and** an
      explicit step-up classification in `ROLE_META` (step-up coverage
      gate catches this).
- [ ] `apps/web-v2/lib/auth/data-isolation.test.ts` covers any new BFF
      guard that is added — server authoritative on the **active**
      role, never the held set.
- [ ] `apps/web-v2/lib/auth/learner-under-parent.test.ts` covers any
      new parent-only or family-shared surface — learner must always
      be rejected with the parent role still in `roles[]`.
- [ ] `pnpm --filter @aivo/web-v2 test:a11y` (per-role `@a11y` suite
      under `e2e/role-a11y.playwright.ts`) runs clean against the
      release candidate build.

When this checklist is complete, attach it to the release ticket and
proceed with submission. ADR 0020 §1/§5 is the load-bearing reason
behind every item here.
