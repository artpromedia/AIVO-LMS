# UX-12 — Unified Mobile App Architecture & Role Switching

> **Last refreshed**: 2026-05-17 — verified current. The five-route-group fragmentation in `apps/mobile/app/{(parent),(learner),(teacher),(caregiver),(therapist)}` is still in place; `apps/mobile/app/index.tsx` still routes on `user.role`; the unified-shell migration is still tracked as DD-04 (P0) in UX-00. UX-13 (this batch) documents the per-mode role experiences that land *into* this shell.
>
> **Source of truth.** Grounded in `apps/mobile/app/**`. The mobile app today is **fragmented into five separate role groups** — `(parent)`, `(learner)`, `(teacher)`, `(caregiver)`, `(therapist)` — gated by a switch on `user.role` in `app/index.tsx`. UX‑00 flagged this as a structural problem; this doc proposes the unified-app architecture and identifies the migration path.
>
> **Status legend:** ✅ shipped · 🟡 partial · ⬜ planned.

## 1. The problem

`apps/mobile/app/index.tsx` (lines 50–67) routes a freshly authenticated user into exactly one of five sibling Expo Router groups:

```ts
switch (user.role) {
  case 'PARENT':    router.replace('/(parent)');
  case 'LEARNER':   router.replace('/(learner)');
  case 'TEACHER':   router.replace('/(teacher)');
  case 'CAREGIVER': router.replace('/(caregiver)');
  case 'THERAPIST': router.replace('/(therapist)');
  default:          router.replace('/(auth)/login');
}
```

Each group has its own tab bar, its own settings screen, its own profile screen, and its own copy of shared concerns (subjects, library, rewards, …). A parent who is also a substitute teacher for their child's class signs in as one role and **cannot see the other surface without logging out**. Worse, a multi‑role professional (a therapist who also has their own children on the platform) has to keep two app installs or accept losing one role.

The cost shows up in three ways:

1. **User confusion** — *"why can't I see my own kid?"* support tickets.
2. **Code drift** — five copies of *Settings* mean five chances for the FERPA disclosure footer to fall out of sync.
3. **Onboarding friction** — every new role today requires a new top‑level group, which means new auth wiring and new push registration.

## 2. Principles for the unified app

1. **One app, one identity, many hats.** A signed‑in user has a list of *active roles*; the active role is a per‑session choice, not a sign‑in choice.
2. **Role context is global, surfaces are shared.** *Subjects*, *Library*, *Rewards*, *Settings* are one screen each, parameterized by active role.
3. **Role switching is fast and reversible.** From any screen, two taps to switch role; the previous deep link is remembered.
4. **Default to the highest‑frequency role.** If the user is a parent + occasional teacher, default to parent. Persist the last‑used role across launches.
5. **Hard boundaries hold.** Switching to *Teacher* doesn't reveal parent‑only data. Each repo call still re‑authorizes against the active role on the server.

## 3. Target architecture (⬜)

```
apps/mobile/app/
  _layout.tsx                 // unchanged: providers, fonts, auth
  index.tsx                   // simplified: redirect to /(app) or /(auth)/login
  accept-invite.tsx           // unchanged
  (auth)/                     // unchanged: login, change-password, forgot-pw
  (app)/                      // NEW: the one signed-in container
    _layout.tsx               // RoleContext.Provider, bottom tab nav
    home.tsx                  // role-aware Today / Triage
    subjects.tsx              // role-aware (learner sees their map; parent/teacher see kid map)
    library.tsx               // shared
    rewards.tsx               // shared (learner authoritative; parent/teacher view-only)
    chat.tsx                  // shared (parent ↔ teacher messaging; therapist notes)
    settings/
      index.tsx
      role-switcher.tsx       // explicit screen + bottom-sheet shortcut
      privacy.tsx
      accessibility.tsx
```

The five role groups (`(parent)`, `(learner)`, `(teacher)`, `(caregiver)`, `(therapist)`) collapse into one signed‑in container. Role‑specific affordances live **inside each shared screen**, gated on `useActiveRole()`.

### Why a single `(app)` group is enough

Expo Router supports `(group)` syntax to organize screens without affecting URLs. Five sibling groups force five duplicate `_layout.tsx` trees and five tab bars. One `(app)` group with a role‑aware tab bar handles every case — and Expo's deep linking still works (`/subjects` resolves whether the user is parent or learner).

## 4. Role context (⬜)

### Shape

```ts
type ActiveRole = "PARENT" | "LEARNER" | "TEACHER" | "CAREGIVER" | "THERAPIST";

type RoleContextValue = {
  available: ActiveRole[];       // every role this user holds
  active: ActiveRole;            // current selection
  setActive: (r: ActiveRole) => Promise<void>;  // persists + reroutes if needed
  /** True when active === "PARENT" and an active-learner cookie is set. */
  hasActiveLearner: boolean;
};
```

`available` comes from `/api/auth/roles` on first auth and is cached. `active` persists to `AsyncStorage` keyed by `userId` (not globally — a shared device serving two parents must not bleed).

### Switching UX

1. **Persistent header pill** — the AppHeader shows a *"You're a {role}"* pill on every screen. Tap → bottom sheet.
2. **Bottom sheet** — list of `available` roles with the active one checked. Tap a row → close sheet, update context, re‑render in place.
3. **Per‑role deep‑link memory** — switching to *Teacher* lands you on the last *Teacher* surface you saw, not the *Teacher* home. Stored as `lastPath[role]` in AsyncStorage.

### Permission boundary

Client trust is zero. Every BFF call carries the user's session cookie; the server reads the active role from a **separate** header (`x-aivo-active-role`) and re‑authorizes. A learner client cannot manufacture a `x-aivo-active-role: TEACHER` header because the server checks that role against the authenticated user's `available` set.

## 5. Screen catalog (proposed, role‑aware)

| Screen | Parent | Learner | Teacher | Caregiver | Therapist |
|---|---|---|---|---|---|
| `home` | Today + nudges | Today's Mission | Triage list | Daily routine | Today's caseload |
| `subjects` | Active learner's map | Own map | Class skill heatmap | Active learner's map | Active learner's map |
| `library` | All resources | Age‑filtered | Curriculum docs | All resources | Therapy resources |
| `rewards` | Active learner's badges | Own XP/badges | Class engagement | Active learner's badges | (hidden) |
| `chat` | Parent ↔ Teacher | (hidden) | Parent ↔ Teacher | Parent ↔ Teacher | Therapy notes |
| `settings` | Shared shell | Shared shell | Shared shell | Shared shell | Shared shell |

**Rule:** if a screen renders nothing for a role, hide the tab — don't ship an empty tab.

## 6. Authentication and onboarding flow (✅ today, retained)

These flows already work and are unchanged by the unified app:

- `app/index.tsx` reads `useAuth`, redirects to `/(auth)/login` when not authed.
- `mustChangePassword` is honored *before* role routing (`app/index.tsx:31-34`). The unified architecture preserves this gate.
- Pending deep links from `accept-invite.tsx` are consumed *after* the password gate and *before* role routing (`app/index.tsx:42-49`). Retained.

The single change: line 50–67's `switch` collapses to `router.replace('/(app)')`.

## 7. Migration path (⬜)

The five role groups can't all collapse in one PR — each carries production data and live screens. Stage the migration:

### Stage 1 — Add `(app)` alongside the existing groups

- Create `(app)/_layout.tsx` with the role context.
- Add a feature flag `MOBILE_UNIFIED_APP` (default off).
- `app/index.tsx` routes to `(app)` when the flag is on for that user, falls back to the legacy switch otherwise.

### Stage 2 — Move shared screens first

- Move `settings`, `library`, `rewards` into `(app)`. They have the least role‑specific divergence.
- Delete their copies in the five legacy groups.

### Stage 3 — Move role‑specific screens with a parameterized version

- `home.tsx` in `(app)` selects render based on `useActiveRole()`. Each branch was already a separate page; you're not rewriting, you're concatenating.
- Same for `subjects.tsx`.

### Stage 4 — Cut over

- Flip the flag on for all users.
- Delete the five legacy groups.
- Update `app/index.tsx` to the simplified version.

Each stage ships independently and is rollback‑safe.

## 8. Microcopy (⬜)

| Surface | String |
|---|---|
| Role pill | *"You're a {role}"* |
| Bottom sheet header | *"Switch role"* |
| Role with no learner attached (parent) | *"Add a learner to get started"* |
| Switching mid‑task | *"Save your progress before switching?"* (only when there's unsaved state) |
| Single‑role user | *(pill renders without tap affordance — visual only)* |

## 9. State matrix

| State | UX |
|---|---|
| Single role | Pill is informational only. No bottom sheet. |
| Two roles | Pill is tappable. Bottom sheet shows both. |
| Parent role, no active learner | Pill shows *"Parent"*; subjects/rewards tabs route to `/learner/select`. |
| Role switch while a session is in progress | If unsaved state exists (e.g. mid‑lesson on learner), prompt before switch. Otherwise switch silently. |
| Role removed mid‑session | (rare — admin revokes teacher access during a session) On next BFF call, server returns 403; client clears active role, re‑evaluates `available`, redirects. |
| Account suspended | Same as auth failure — redirect to `/(auth)/login`. |

## 10. Engineering handoff

| Concern | Where |
|---|---|
| Legacy role switch | `apps/mobile/app/index.tsx:50-67` — to be simplified |
| Auth hook | `apps/mobile/hooks/useAuth.ts` — add `availableRoles` to the user shape |
| Role context | New: `apps/mobile/lib/roleContext.tsx` |
| Tab bar | New: `apps/mobile/app/(app)/_layout.tsx` |
| Persistence | `AsyncStorage` key `aivo.activeRole.{userId}` |
| Active‑role header | Wire `x-aivo-active-role` into the `fetch` wrapper in `apps/mobile/lib/api.ts` |
| Server‑side check | Web BFFs already enforce role via `requirePageRole`. Mobile BFFs (under `services/identity-svc` etc.) need the same check against the new header. |
| Feature flag | `MOBILE_UNIFIED_APP` in `apps/mobile/lib/flags.ts` |

## 11. Acceptance criteria — honest

- ✅ The auth → password‑rotation → deep‑link → home routing flow is preserved.
- ⬜ A user holding two roles can switch between them without logging out.
- ⬜ Each role lands on the screen it was last viewing for that role.
- ⬜ Shared screens (`settings`, `library`, `rewards`) exist exactly once in the codebase.
- ⬜ Server‑side BFFs re‑authorize on the active‑role header, not just the session.
- 🟡 Today's mobile app fragments into five role groups (see §1). UX‑00 flagged this; this doc is the proposed fix.

## 12. Open questions

1. **Is *Therapist* a real role on day one of the unified app, or do we defer?** The legacy `(therapist)` group exists but is the thinnest. Decision affects whether *Chat* needs a *Therapy notes* mode in v1.
2. **Cross‑role notifications.** If a parent receives a push about their kid's lesson while signed into the *Teacher* role, do we auto‑switch or show a banner *"This is for your Parent view — tap to switch"*? The latter respects the principle in §2.4 but adds friction.
3. **Shared device, two parents** — today auth covers this. Confirm the active‑role persistence in §4 is keyed by `userId`, not device, so a logout flushes correctly.
4. **Tablet layout.** This doc assumes phone tab‑bar. Tablet (the learner's primary device per UX‑05) deserves its own pass — likely a sidebar instead of bottom tabs. Out of scope here.
