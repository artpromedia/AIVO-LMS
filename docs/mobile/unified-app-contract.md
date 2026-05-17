# Unified mobile app contract (Sprint 09)

## Today vs. target

| | Today (legacy) | Target (unified) |
|---|---|---|
| Shell | Per-role: `app/(parent)`, `(learner)`, `(teacher)`, `(caregiver)`, `(therapist)` | Single `app/(app)/_layout.tsx` |
| Role switching | Re-login required | Two-tap switcher; same identity |
| Server hint | none | `x-aivo-active-role: <role>` on every request |
| Authorization | Per-role; cross-role data leaks possible if the wrong shell renders | Server enforces against token role claims; header is a hint only |
| Offline | n/a | Lesson responses queue; flush on reconnect; dedupe by `idempotencyKey` |

## Feature flag

Defined in `apps/mobile/lib/feature-flags.ts`:

```ts
MOBILE_UNIFIED_APP = process.env.EXPO_PUBLIC_MOBILE_UNIFIED_APP ?? false
```

Defaults to `false`. Flip in the same commit that removes the legacy
role-group directories. The flag is read once at app start.

## RoleContext

`apps/mobile/lib/role-context.tsx` exports:

| Symbol | Purpose |
|---|---|
| `RoleProvider` | Wraps the unified shell; owns active-role state |
| `useRole()` | Hook for screens / chrome to read `availableRoles`, `activeRole`, `lastPathByRole`, `activeLearner` |
| `ACTIVE_ROLE_HEADER` | The string constant `x-aivo-active-role` — keep in lock-step with `apps/mobile/lib/api.ts` |

State invariants:

- `availableRoles` comes from `useAuth().user` — extended in Sprint 09
  to `availableRoles: UserRole[]` instead of the legacy single `role`.
- `activeRole` MUST be a member of `availableRoles`; `setActiveRole`
  throws otherwise.
- `lastPathByRole` is a per-role last-visited path so a switch
  returns the user to where they left off.
- `activeLearner` is non-null for parent / teacher / caregiver /
  therapist; for `learner` role the user IS the learner, so it
  mirrors `user.learnerId`.

## Server enforcement

`x-aivo-active-role` is sent on every authenticated request. The
server uses it strictly as a hint for response shaping and audit
logging — **never** as a privilege grant. The actual decision is:

1. Decode JWT; collect role claims.
2. If the requested route requires role `R`, ensure `R` is in claims.
3. If `x-aivo-active-role: R` is present, log it against the audit
   event. If `R` is not in claims, reject the request with 403
   `FORBIDDEN_ROLE` and audit-log a `auth.active_role.spoofing`
   event (Sprint 14 catches repeated spoofing attempts).

The identity-svc shared middleware that lives at
`services/identity-svc/src/hooks/auth.ts` is the right place for the
active-role check. Sprint 09 follow-up adds the middleware on the
server side; for now the header is propagated but not yet validated.

## Migration steps (Sprint 09 → 09b → 09c)

The current legacy shells stay in tree behind a stable flag while we
incrementally land the unified shell. The order:

1. **Sprint 09 (this PR)** — `MOBILE_UNIFIED_APP` flag, `RoleContext`
   scaffolding, contract doc, audit script.
2. **Sprint 09a** — `apps/mobile/app/(app)/_layout.tsx`, role
   chooser screen (`/role-chooser`), role switcher chrome component,
   account/me/login screens move to unified.
3. **Sprint 09b** — parent + learner shared screens (home, library,
   inbox, settings) move under unified; legacy `(parent)` and
   `(learner)` deleted; `MOBILE_UNIFIED_APP` defaults to `true`.
4. **Sprint 09c** — teacher / caregiver / therapist shared screens
   move; legacy directories deleted; offline queue lands; flag
   removed entirely.

No screen is moved without a parity test that exercises:
- read flows in the new shell match the legacy flow
- write flows on the same data store
- role switch preserves `lastPathByRole`
- server rejects `x-aivo-active-role` for a role the token does not
  grant

## Offline queue (Sprint 09c)

Learner lesson-response submissions enqueue locally when offline:

- Storage: `expo-sqlite` queue table
- Item shape: `{ idempotencyKey, lessonRunId, payload, queuedAt }`
- Flush: triggered on `NetInfo` `isConnected: true` event
- Dedupe: server rejects duplicate `idempotencyKey` with 200 (no-op)
- Stale: items older than 7 days are dropped and a parent
  notification is emitted

## Audit gate

`scripts/mobile-unified-audit.mjs` (root script `mobile:audit`):

1. `apps/mobile/lib/feature-flags.ts` declares `MOBILE_UNIFIED_APP`.
2. `apps/mobile/lib/role-context.tsx` exports `RoleProvider`,
   `useRole`, and `ACTIVE_ROLE_HEADER`.
3. The legacy role-group directories still exist (a soft signal
   during migration; once `MOBILE_UNIFIED_APP` defaults to `true`
   this assertion is removed and the script asserts the directories
   are gone instead).
4. `apps/mobile/lib/api.ts` references `ACTIVE_ROLE_HEADER` when the
   flag is on (advisory until Sprint 09a).

## Verification

```bash
pnpm mobile:audit
pnpm --filter @aivo/mobile test
```
