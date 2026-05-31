# 0020 — Single shell per platform, multi-role identity

- **Status:** Accepted
- **Date:** 2026-05-31
- **Related:** Sprint 09 unified mobile app, Sprint 10 therapist/caregiver
  rollout, `docs/mobile-parity.md`, `docs/ux/route-matrix.md`,
  `packages/nav/src/roles.ts`

## Context

AIVO is product-positioned as **one application** that re-skins itself for
five learner-facing roles — **learner, parent, teacher, therapist,
caregiver** — plus three administrative roles (school-admin,
district-admin, internal). Earlier proposals to ship one mobile binary
per role (e.g. "AIVO Parent", "AIVO Teacher") would have:

- Required separate App Store / Play Store listings, ASO, screenshots,
  reviews, crash-reporting projects, and EAS build profiles per role.
- Forced users with multiple roles (a parent who is also a teacher,
  a caregiver who is also a therapist) to install and sign in to several
  apps to do their work.
- Duplicated the entire shell — auth, navigation, brand theming,
  notifications, settings, billing — five times.
- Diverged the per-role binaries over time, defeating the parity gates
  already in place (`mobile:audit`, `route:audit`, `brand:check`).

The shipped architecture is already the single-shell one: there is
exactly one Next.js app (`apps/web-v2`) and one Expo app (`apps/mobile`),
both with role-segmented routes
(`app/{learner,parent,teacher,therapist,caregiver}/*` on web;
`app/(learner|parent|teacher|therapist|caregiver)/*` on mobile). The
canonical role registry lives in `packages/nav/src/roles.ts`, brand
theming is per-role via `@aivo/brand`, and mobile already has a unified
`RoleProvider` (`apps/mobile/lib/role-context.tsx`).

This ADR makes that architectural decision **explicit and binding** so
that future work cannot accidentally split the shells, and so that new
roles extend the registry rather than spawning new apps.

## Decision

### 1. Two shells, period

- **Web** ships as `@aivo/web-v2` only.
- **Mobile** ships as `@aivo/mobile` only.
- **Marketing** (`apps/marketing`) remains a separate site whose only
  job is to drive sign-up into the web shell; it is not a role surface.

No new top-level application may be added under `/apps` for the purpose
of serving a specific role. Adding `apps/parent`, `apps/teacher-mobile`,
`apps/therapist-web`, etc. is prohibited. Compliance is enforced by
`scripts/single-shell-audit.mjs`, wired as `pnpm shell:audit`, and run
in CI.

### 2. Role surfaces are route segments, not apps

All role-specific UX lives under role-segmented routes inside the two
existing shells:

- Web: `apps/web-v2/app/{learner,parent,teacher,therapist,caregiver,
  district,admin}/...`
- Mobile: `apps/mobile/app/(learner|parent|teacher|therapist|caregiver|...)/...`

Role-segmented routes own **content** only. Cross-cutting chrome
(top bar, role chip, role switcher, notification bell, settings,
profile menu, nav rail / tab bar) is owned by the shared shells in
`packages/ui` (web) and `packages/mobile-ui` (mobile).

### 3. New roles extend the registry, not the app list

To introduce a new role:

1. Add the id to the `Role` union and the `ROLES` array in
   `packages/nav/src/roles.ts`.
2. Add a `ROLE_META` entry with `onWeb`, `onMobile`, and
   `requiresStepUp` set correctly.
3. Add the role's row to the permission `MATRIX` in
   `packages/nav/src/permissions.ts`.
4. Add route segments under both shells (or omit the segments and rely
   on a `locked` permission until the surface is ready).

Step 1 is the only step that grants the role identity; steps 2–4 are
how that identity becomes navigable. **Do not create a new `apps/*`
entry for the new role.**

### 4. Role identity is server-authoritative

The user's roles and active role come from the server:

- `GET /me` is the single source of truth for
  `{ id, roles: Role[], activeRole: Role, capabilities: string[] }`.
- `POST /me/active-role` mutates the active role and triggers step-up
  re-auth when `ROLE_META[role].requiresStepUp` is true (parent,
  teacher, therapist, caregiver, and all admin roles).
- Backend authorization keys off the **active role** carried in the
  access token / surface cookie, not "any role the user happens to
  hold." The client switcher must never be the only gate; see Sprint 5
  surface-cookie work and `packages/security/src/surface-cookie.ts`.

Client-side, the active role is cached in `@aivo/security`'s session
store on web and in `apps/mobile/lib/role-context.tsx` on mobile. Both
caches are advisory; a stale cache must never grant access the server
would deny.

### 5. One artifact per platform at release time

- **Web:** `apps/web-v2` is the only Next.js deployable that serves
  authenticated users.
- **Mobile:** a single iOS bundle id and a single Android package id,
  one App Store listing, one Play Store listing. EAS profiles exist for
  environments (preview / staging / production) — **not** per role.
  Per-role rollout is done by `@aivo/feature-flags`, not by shipping
  separate binaries.

## Consequences

- Engineers who want to scaffold "a new app for X role" must instead
  add a route segment and (if needed) gate it behind a feature flag.
  `pnpm shell:audit` will fail the PR if they don't.
- Store-listing copy, screenshots, and ASO must speak to the
  multi-role product. Marketing owns the copy; engineering keeps the
  listing inventory at one per platform.
- The `RoleSession` type in `@aivo/nav` (added alongside this ADR) is
  the contract every shell, hook, and BFF route must consume.
- Cross-cutting surfaces (messages, notifications, settings, billing)
  should migrate to top-level routes that read `activeRole` for
  filtering, rather than living under each role segment. This work is
  Phase 2 of the implementation map and is tracked separately.
- The RBAC matrix in `packages/nav/src/permissions.ts` becomes the
  single audit surface for "which role can see what." A new
  matrix-coverage test ensures no `Role × NavArea` pair is left
  unclassified.

## Non-goals

- This ADR does **not** redefine any of the existing roles, change the
  step-up policy, or alter how `@aivo/brand` tokens are emitted.
- It does **not** require collapsing existing per-role
  `/messages` or `/settings` routes today; that migration is sequenced
  in the implementation map's Phase 2.
- It does **not** address marketing-site architecture beyond noting
  that `apps/marketing` is not a role surface.

## Phase 2 — cross-cutting surface migration

The Phase 2 work the Consequences section refers to migrates four
cross-cutting features off their per-role routes onto top-level
routes that read `activeRole` and filter content accordingly. The
typed registry that pins the sequence and canonical destinations
lives in `packages/nav/src/cross-cutting.ts` (`CROSS_CUTTING_REGISTRY`).
Migrations happen in phase order; each phase is its own PR.

| Phase | Surface         | Web route        | Mobile route     | Anchored NavArea | Why this order                                                                 |
| ----- | --------------- | ---------------- | ---------------- | ---------------- | ------------------------------------------------------------------------------ |
| 1     | `notifications` | `/notifications` | `/notifications` | `messages`       | Lowest risk; mobile already has a partial unified inbox to lift from.          |
| 2     | `messages`      | `/messages`      | `/messages`      | `messages`       | Shares unread counters with notifications; ships once Phase 1 is stable.       |
| 3     | `settings`      | `/settings`      | `/settings`      | `settings`       | Needs `activeRole`-aware section visibility; every shell ships a bespoke one. |
| 4     | `billing`       | `/billing`       | `/billing`       | `billing`        | Highest risk: Stripe surfaces + copy varies most by role (self-pay vs PO).     |

Rules each migration PR must follow:

1. **Anchor RBAC on `canAccessArea`.** The top-level route consults
   `canAccessArea(session, area, surface)` (where `area` is the
   `navArea` field of the registry entry) and renders the same four
   outcomes `<RoleGate>` / `useNavAccess` produce. No new RBAC table.
2. **Delete or 301 every legacy per-role route** in
   `CROSS_CUTTING_REGISTRY[id].legacyRoutes` for the surface being
   migrated. The route audit will flag any that remain.
3. **Update the registry, not the prose.** If the migration changes a
   canonical destination, edit `cross-cutting.ts` and the matrix
   coverage test will catch downstream drift; do not rely on this
   ADR's table being kept in sync.
4. **Ship one surface per PR.** The phase numbers exist so a future
   automation gate can fail PRs that mix phases or skip ahead.

## Phase 1 — Unified identity & role switching (backend)

The backend half of the multi-role contract landed alongside this
ADR. The implementation lives entirely in `apps/web-v2` so it can be
exercised end-to-end without a real identity-svc:

- **`GET /api/bff/me`** (`apps/web-v2/app/api/bff/me/route.ts`)
  returns the canonical `{ id, tenantId, roles[], activeRole,
  capabilities[] }` payload via `buildRoleSession()`
  (`apps/web-v2/lib/auth/role-session.ts`).
- **`POST /api/bff/me/active-role`**
  (`apps/web-v2/app/api/bff/me/active-role/route.ts`) flips the
  active role. The pure decision logic lives in
  `apps/web-v2/lib/auth/active-role.ts` (`decideActiveRoleSwitch`)
  so it is unit-testable under vitest.
  - Validates `target ∈ session.roles[]`; otherwise 403
    `FORBIDDEN_ROLE`.
  - When `ROLE_META[target].requiresStepUp === true`, requires a
    fresh `x-step-up-token` header verified by
    `verifyRoleChangeStepUp()`
    (`apps/web-v2/lib/auth/step-up-verify.ts`). Real-mode delegates
    to `@aivo/security` `verifyJWT` (`purpose: "step-up"`,
    `scope: "role:change"`, `sub === session.userId`); mock-mode
    accepts a deterministic `mock-stepup.<role>.<exp>` token so dev
    flows work without identity-svc.
  - On success sets `aivo_active_role` and re-mints the
    `aivo_session_role` surface cookie via
    `signSurfaceCookieValue()` from `@aivo/security`. Edge
    middleware now reads the **active** role, satisfying ADR 0020
    §4 ("backend authorization keys off active role, not any role
    the user happens to hold").
- **Mock multi-role overlay** (`apps/web-v2/lib/auth/mock-session.ts`)
  layers two cookies on top of the existing mock session so dev
  fixtures can hold multiple roles:
  - `aivo_session_roles` — comma-separated list of extra roles
    (e.g. `parent,teacher,caregiver`).
  - `aivo_active_role` — the currently active role; when set, the
    underlying `MOCK_USERS` fixture is swapped so `session.role`,
    `displayName`, and `permissions` reflect the active surface
    while `userId` / `tenantId` stay stable.

The web ↔ nav role-id mapping (`school_admin` ↔ `schoolAdmin`,
`platform_admin` ↔ `internal`, etc.) is centralised in
`apps/web-v2/lib/auth/role-session.ts` so role registry additions in
`packages/nav/src/roles.ts` only need a single mapping update on the
web side.

The real-mode `identity-svc` refresh-token flow (issuing a JWT whose
`role` claim follows `activeRole` on rotation) is the remaining
slice — tracked separately; the BFF contract above is the gate that
unblocks the client refactor in Phase 1's "Client" bullet.

