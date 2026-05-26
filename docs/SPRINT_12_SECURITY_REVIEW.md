# Sprint 12 — Security Review (v1 cutover)

- **Status:** Draft — awaiting sign-off
- **Date:** 2026-05-26
- **Scope:** v1.0 production cutover; covers BFF, identity, AI, IEP and
  caregiver attachment surfaces. Companion to `docs/SPRINT_12_V1_CUTOVER.md`
  and `docs/launch-readiness.md`.

This review is a code-evidence checklist. Every line below cites the file or
test that establishes the control. Reviewers tick the box only after opening
that file and confirming the control still applies.

---

## 1. `requireRole` on every BFF route

Reference middleware: `apps/web-v2/lib/auth/require-role.ts` (mirror of the
canonical `services/identity-svc/src/middleware/require-role.ts`). The BFF
contract is: every non-public route imports `requireRole(...)` and short-circuits
on 401/403 before any downstream call.

Confirmed routes (sample, verified against `apps/web-v2/app/api/bff/**/route.ts`,
127 total):

- [ ] `GET /api/bff/admin/audit-logs` → `PLATFORM_ADMIN, DISTRICT_ADMIN`
      (`apps/web-v2/app/api/bff/admin/audit-logs/route.ts`)
- [ ] `GET|POST /api/bff/admin/users` → `PLATFORM_ADMIN, DISTRICT_ADMIN`
      (`apps/web-v2/app/api/bff/admin/users/route.ts`)
- [ ] `PATCH /api/bff/admin/users/[userId]` → `PLATFORM_ADMIN, DISTRICT_ADMIN`
      (`apps/web-v2/app/api/bff/admin/users/[userId]/route.ts`)
- [ ] `POST /api/bff/admin/ai-generation` → `PLATFORM_ADMIN`
      (`apps/web-v2/app/api/bff/admin/ai-generation/route.ts`)
- [ ] `GET|POST /api/bff/admin/compliance/retention` → `PLATFORM_ADMIN`
      (`apps/web-v2/app/api/bff/admin/compliance/retention/route.ts`)
- [ ] `GET|POST /api/bff/admin/compliance/disclosures` → `PLATFORM_ADMIN`
      (`apps/web-v2/app/api/bff/admin/compliance/disclosures/route.ts`)
- [ ] `GET /api/bff/admin/seats` → `PLATFORM_ADMIN, DISTRICT_ADMIN`
      (`apps/web-v2/app/api/bff/admin/seats/route.ts`)
- [ ] `GET /api/bff/admin/billing` → `PLATFORM_ADMIN, DISTRICT_ADMIN`
      (`apps/web-v2/app/api/bff/admin/billing/route.ts`)
- [ ] `GET /api/bff/parent/subscription` → `PARENT`
      (`apps/web-v2/app/api/bff/parent/subscription/route.ts`)
- [ ] Engagement service guards: `services/engagement-svc/src/routes/lessonPlans.ts`
      uses the canonical `requireRole` from `services/engagement-svc/src/auth.ts`.

Verification command:

```bash
# Every BFF route file must reference requireRole (allow-list known
# public routes: /health, /session, /me, /auth/refresh).
node scripts/internal/audit-bff-require-role.mjs
```

- [ ] All 127 BFF routes covered; allow-listed public routes documented in
      `apps/web-v2/app/api/bff/PUBLIC_ROUTES.md`.

## 2. Cross-tenant boundary verification

The 5 tenant-isolation Playwright/Vitest specs that must pass before cutover:

- [ ] `e2e/tenant-isolation/admin-cross-tenant-read.spec.ts` — admin from
      tenant A receives 403 reading `/api/bff/admin/users?tenantId=B`.
- [ ] `e2e/tenant-isolation/learner-cross-tenant-lesson.spec.ts` — learner
      from tenant A cannot fetch lessonRun from tenant B (404 not 403,
      to avoid existence disclosure).
- [ ] `e2e/tenant-isolation/parent-cross-tenant-children.spec.ts` — parent
      sees only their own children even if `learnerId` is enumerated.
- [ ] `e2e/tenant-isolation/therapist-cross-tenant-session.spec.ts` —
      therapist booking session for learner in another district is rejected.
- [ ] `e2e/tenant-isolation/caregiver-cross-tenant-attachment.spec.ts` —
      caregiver upload bound to wrong learnerId is rejected at the BFF
      before reaching object storage.

Verification command:

```bash
pnpm --filter e2e test:tenant-isolation
```

## 3. Responsible-AI fail-closed behavior

The moderation client must fail closed: if the moderation endpoint is
unreachable or returns a 5xx, the generation request is denied — never
allowed through silently.

- [ ] `services/ai-svc/src/responsible_ai/moderation_client.py` —
      `evaluate()` raises `ModerationUnavailable` on transport errors;
      callers translate that to a `503` + audit event.
- [ ] `services/ai-svc/src/responsible_ai/__init__.py` — wired into the
      generation pipeline before `LLMProvider.generate()`.
- [ ] Unit test: `services/ai-svc/tests/test_responsible_ai_fail_closed.py`
      simulates upstream 503 and asserts denial + audit emit.

## 4. Caregiver attachment sanitizer

Caregiver uploads are the only end-user-file ingestion path. Must be
constrained to a small image/document whitelist and re-encoded before
storage.

- [ ] Whitelist enforced in `services/comms-svc/src/attachments/sanitize.ts`:
      formats `image/jpeg`, `image/png`, `image/webp`, `application/pdf`;
      max 20 MB; magic-byte sniff (not just extension).
- [ ] Images are re-encoded server-side via `sharp` and stripped of EXIF.
- [ ] Filename normalized to `att_<ulid>.<ext>` before reaching storage.
- [ ] Unit test: `services/comms-svc/tests/sanitize.spec.ts` covers
      polyglot upload, oversize, and EXIF strip.
- [ ] BFF route: `apps/web-v2/app/api/bff/caregiver/attachments/route.ts`
      delegates entirely to the sanitizer; no raw bytes are persisted.

## 5. Step-up auth for destructive admin actions

The following actions require a fresh re-auth (WebAuthn or TOTP within the
last 5 minutes), in addition to the role check:

- [ ] User delete: `apps/web-v2/app/api/bff/admin/users/[userId]/route.ts`
      DELETE handler calls `requireStepUp({ maxAgeMs: 5 * 60 * 1000 })`.
- [ ] Tenant delete: `apps/web-v2/app/api/bff/admin/tenants/route.ts`.
- [ ] Retention purge execution: `apps/web-v2/app/api/bff/admin/compliance/retention/route.ts`.
- [ ] Migration trigger: `apps/web-v2/app/api/bff/admin/migration/route.ts`.
- [ ] Feature-flag override at 100%: `apps/web-v2/app/api/bff/admin/feature-flags/route.ts`.

Verification command:

```bash
pnpm --filter web-v2 test step-up-auth.spec.ts
```

## 6. Audit-event emission for every state-mutating endpoint

Every BFF route that mutates state must emit an audit event via
`emitAuditEvent({ actorId, tenantId, action, target, requestId })`. The
no-demo audit confirms this is in place for the v1 surface.

- [ ] `scripts/ai-safety-audit.mjs` passes (covers ai-gen routes).
- [ ] `scripts/billing-audit.mjs` passes (covers billing routes).
- [ ] `scripts/comms-audit.mjs` passes (covers caregiver/teacher comms).
- [ ] `scripts/consent-gate-audit.mjs` passes.
- [ ] `pnpm route:audit` confirms every non-GET BFF handler invokes
      `emitAuditEvent` (advisory mode: gates lint output for missing emit).

Verification command:

```bash
pnpm route:audit && pnpm ai-safety:audit && pnpm comms:audit && pnpm billing:audit
```

---

## Sign-off

| Role | Name | Date | Signature / commit SHA |
| --- | --- | --- | --- |
| Security lead | | | |
| Ops lead | | | |
| On-call engineer (cutover) | | | |
| Eng lead (cutover) | | | |

Cutover may not proceed until all four rows are filled and every checkbox
above is checked. Signed copies of this document are archived under
`docs/security/signoff/sprint-12-<YYYY-MM-DD>.md`.
