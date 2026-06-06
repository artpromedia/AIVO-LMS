# AIVO Mobile (`@aivo/mobile`)

Expo SDK ~54 · React Native 0.81 · React 19 · expo-router ~6 · Reanimated ~4.1.

The mobile app is the native sibling of `apps/web-v2`. Parity is judged by
**user job covered**, not pixels — native patterns (tabs, sheets, stacks) are
expected. Role groups: `(auth)`, `(onboarding)`, `(parent)`, `(learner)`,
`(teacher)`, `(therapist)`, `(caregiver)`.

## Verify

```bash
pnpm install
pnpm --filter @aivo/mobile lint
pnpm --filter @aivo/mobile test     # vitest (node env)
pnpm --filter @aivo/mobile start     # cold-start on a device / simulator
```

## Conventions

- New screens fetch real data with `@tanstack/react-query` over `apiFetch`
  (`lib/api.ts`) against the per-service `API.*` bases (`constants/api.ts`),
  and render genuine loading / empty / error states — never stubs.
- Reuse the shared primitives: `@aivo/mobile-ui` (`AivoCard`, `AivoButton`,
  `EmptyState`, `LoadingState`, `StatCard`, chart kit), the inclusive-warm
  `components/ui` (`Button`, `Card`, `SensoryToggle`), `useSensoryPalette`,
  and `useTranslation` (string keys with English fallbacks — onboarding-style
  inline defaults keep the 10-locale catalog in parity).
- New routes are registered in their group `_layout.tsx`; the app builds with
  `experiments.typedRoutes` enabled.

## Parity & platform decisions

| Topic | Decision | Rationale |
|------|----------|-----------|
| **District portal** (web `district/login`) | **Out of scope on mobile** | The district/admin portal is an admin-svc-backed desktop surface. Mobile ships no `(district)` group and no admin-svc client, and parity here means the in-app family/education roles (parent · learner · teacher · therapist · caregiver). A faithful read-only port would need new admin-svc endpoints + auth we can't stand up without shipping stubs, which the no-stub rule forbids. Revisit if/when a district mobile job is defined. |
| **Onboarding `parent-setup`** (web household name + co-parent invite) | **Reused existing surfaces — no new screen** | The substantive "set up your family" job is covered by `(parent)/onboard.tsx` (add a child: name · grade · PIN · IEP · baseline, backed by real `useAddLearner`), and the co-parent/caregiver invite by `(parent)/team/[childId].tsx` (real family-svc `…/invite/caregiver` with a `relationship`). Web's household-name + co-parent step is backed only by a dev in-memory BFF store (`household-store`) with no production family-svc endpoint, so porting it verbatim would ship a stub. |
| **Onboarding `recovery`** (web account recovery) | **Reused `(auth)/forgot-password.tsx`** | Password recovery already exists in the auth group, calls identity-svc `POST /api/auth/forgot-password`, and is linked from `(auth)/login`. Rather than add a parallel `(onboarding)/recovery.tsx`, the network call was extracted into the unit-tested `src/api/passwordRecovery.ts` and the existing screen now consumes it. |
| **`splash-icon.png`** | **Regenerated** | Rebuilt from `aivo-logo-white.png` into a 1024×1024 RGBA asset: transparent background, white AIVO Learning lockup fit to ~78% canvas width and centered (content bbox ≈ 113,351–910,671). Composites cleanly on the `#7C3AED` `app.json` `backgroundColor` at `imageWidth: 200` via `expo-splash-screen`, and the animated `SplashGate` (white wordmark on the same purple) bridges the handoff. |
| **EAS `owner` / `projectId`** | **Left as configured** | `app.json` sets `owner: "iamofemeofem"` and `extra.eas.projectId`. EAS account ownership can't be verified from this environment (no EAS API access), and changing `owner` blind would itself break builds. Confirm the pairing with `eas whoami` / `eas project:info` before the next EAS build. |

## Closed parity gaps (this change)

- `(caregiver)/observations.tsx` — caregiver observations feed (family-svc
  `GET /api/family/observations`), a new tab; composer reused at
  `child/[childId]/observation.tsx`.
- `(teacher)/reports.tsx` — classroom mastery rollup (brain-svc + family-svc
  IEP), linked from the Analytics tab.
- `(learner)/lesson-runs.tsx` — lesson history (learning-svc
  `GET /api/learning/sessions`), linked from Progress and the stage
  completion screen.

## Branded splash

`components/SplashGate.tsx` bridges native splash → first surface: a centered
white AIVO wordmark on `#7C3AED` with a Reanimated fade+scale entrance,
static under OS reduce-motion. It owns the `expo-splash-screen` hide handshake
(no white flash) and holds until fonts are loaded **and** auth has hydrated.
