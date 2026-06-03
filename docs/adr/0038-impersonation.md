# 0038 — Secure Impersonation ("View As"): just-in-time, claim-scoped, deny-by-default writes

- **Status:** Accepted
- **Date:** 2026-06-03
- **Related:** Sprint 9 — Secure Impersonation; `services/identity-svc`,
  `packages/enterprise-core`, `apps/web-v2` (StartImpersonationModal,
  ImpersonationBanner, history viewers, AppShell watermark); migration 0049;
  ADR 0030 (identity), ADR 0032 (audit architecture).

## Context

Support and compliance staff regularly need to see exactly what a specific
user sees — a learner's broken dashboard, a teacher's missing roster, a
parent's consent state — to diagnose and resolve issues. Doing this by
sharing credentials, resetting passwords, or querying the database directly
is unauditable and over-privileged. The industry pattern is **Privileged
Access Management (PAM) style just-in-time impersonation** ("View As"):
a time-boxed, narrowly-scoped, fully-audited session in which an authorized
admin acts *as* another user.

Impersonation is dangerous to get wrong. Two failure classes dominate:

- **Confused deputy** — the impersonating admin (or a compromised path)
  performs privileged writes that the *subject* could never authorize, or
  escalates by impersonating a higher-privileged user.
- **Audit evasion** — actions taken under impersonation are attributed only
  to the subject, so the real actor disappears from the record, or the
  impersonation itself is never logged.

Additional regulatory weight: subjects are frequently **minors** (FERPA /
COPPA), so impersonating a child requires a stronger, guardian-anchored
consent basis than impersonating an adult employee.

Before this sprint there was no first-class impersonation. This ADR records
the decision to build a signed-JWT, claim-scoped impersonation flow with a
deny-by-default write guard enforced in **every** service, per-request
auditing, and minor-protection consent rules.

## Decision

### 1. The impersonation token is a NEW signed JWT carrying impersonation claims

`POST /api/impersonation/start` (identity-svc) validates RBAC + consent,
requires **step-up MFA**, and mints a brand-new signed JWT for the session.
The authorization-relevant facts live **inside the signed token**, so they
cannot be forged client-side:

| Claim | Meaning |
|---|---|
| `sub` | The impersonated user — the authorization subject for **reads**. |
| `act` | The acting admin's user id (RFC 8693 "actor"). Never lost. |
| `imp` | `true` — marks the token as an impersonation token. |
| `imp_exp` | Hard expiry (unix seconds) of the impersonation window (≤ TTL). |
| `imp_writes_ok` | Whether writes are permitted at all in this session. |
| `imp_reason` | The documented reason for the session (audited). |
| `imp_sid` | The `impersonation_sessions` row id, for correlation/revocation. |

Because `act`/`imp`/`imp_exp`/`imp_writes_ok` are signed, a client cannot
flip `imp_writes_ok`, extend `imp_exp`, or strip `act` without invalidating
the signature. Routes: `/api/impersonation/{start,stop,active,history}`.

### 2. TTL clamp — default 15 min, hard cap 30 min, per-tenant floor 5 min

`clampTtlSeconds` (in `services/identity-svc/src/lib/impersonation.ts`)
resolves the window: default **15 min** when unspecified, never above the
global **30 min** hard cap, never above the **per-tenant max** (itself
floored at **5 min** and capped at 30 min), never below a 60s usable
minimum. `imp_exp` is derived from the clamped TTL, so the session cannot
outlive its window even if the JWT `exp` were mis-set longer.

### 3. RBAC matrix — who may impersonate whom

`evaluateRbac(actor, subject)` enforces:

| Actor role | May impersonate | Constraints |
|---|---|---|
| `platform_admin` | Anyone | Admin targets require a documented **break-glass** code (`requiresBreakGlass`). |
| `district_admin` | Users **in their district** | EXCEPT other district admins or platform admins (`ADMIN_TARGET_FORBIDDEN`); cross-district denied (`CROSS_DISTRICT`). |
| `school_admin` | Learners / teachers / parents **in their school** only | Other roles denied (`OUT_OF_SCOPE`); cross-school denied (`CROSS_SCHOOL`). |
| any | — | Self-impersonation denied (`SELF_IMPERSONATION`). No transitive impersonation (see §6). |

Only `platform_admin` may ever target another admin, and only with a
break-glass code. The actor identity is taken from the caller's own verified
(non-impersonation) token — never from client input.

### 4. Consent rules — minor protections are distinct and stronger

`evaluateConsent(subject, consent, tenant, rbac)` returns a distinct,
audited **basis** per allowed path, so the log records exactly which legal /
operational basis was used:

| Subject | Allowed bases (any one) | Notes |
|---|---|---|
| **Adult (≥18)** | `SUBJECT_CONSENT` (consent_ledger) · `JUSTIFICATION_TICKET` (documented ticket) · `PLATFORM_OVERRIDE` (platform-admin explicit) · `BREAK_GLASS` (admin target) | Three independent, separately-audited bases. |
| **Minor (<18)** | `GUARDIAN_CONSENT` (consent_ledger) · `OPEN_INCIDENT` (open compliance/safety incident) | **Tickets and platform overrides do NOT bypass guardian consent.** |

Tenants can **globally disable** impersonation (`enabled: false` →
`TENANT_DISABLED`), which short-circuits regardless of any other basis. A
subject whose age is unknown is treated as the stricter adult-consent path
by default (fail-safe).

### 5. Every-service write guard — deny-by-default + allowlist

The shared `packages/enterprise-core` auth middleware
(`impersonation-guard.ts` + `fastify-auth.ts`) runs in **every** service.
Under `imp === true`:

- **Reads** are authorized using the **subject's** roles (`sub`).
- **Writes** (`POST|PUT|PATCH|DELETE`) are **denied by default**. A write is
  permitted only when **both** `imp_writes_ok === true` **and** the route
  matches the service's `src/auth/imp-write-allowlist.ts` (exact method +
  path-prefix; nothing matches by default).
- `imp_exp` hard-expiry is enforced on every request; an expired token is
  rejected (and audited as `expired`).

### 6. No transitive impersonation

An impersonation token (`imp === true`) cannot itself start another
impersonation session — `start` rejects callers presenting an impersonation
token. This prevents chaining a low-privilege subject into a privilege
escalation. The actor used for RBAC is always a real admin's own token.

### 7. Per-request audit

Every request under impersonation emits an `auth.impersonation.request`
audit event (via `@aivo/audit-client`, ADR 0032); writes additionally emit
`auth.impersonation.write_allowed` or `auth.impersonation.write_blocked`,
and expired tokens emit `auth.impersonation.expired`. Session start/stop are
audited with the resolved RBAC + consent basis. The acting admin (`act`) is
always recorded, so impersonated actions are never mis-attributed solely to
the subject.

## Threat model

| # | Threat | Mitigation implemented |
|---|---|---|
| T1 | **Privilege escalation via impersonation** (act as a higher-privileged user to gain their rights) | RBAC matrix (§3): only `platform_admin` may target an admin, and only with break-glass; district/school actors are scope-bounded; admin targets otherwise `ADMIN_TARGET_FORBIDDEN`. |
| T2 | **Forging `imp_writes_ok`** to perform writes the subject can't authorize | `imp_writes_ok` lives in the **signed JWT** — tampering breaks the signature. Even when true, writes require an explicit per-service allowlist match (§5), so a forged-or-flipped flag still can't reach a non-allowlisted route. |
| T3 | **Transitive chaining** (use a session to start another, climbing privilege) | `start` refuses to mint from an impersonation token — no transitive impersonation (§6). |
| T4 | **Stale / long-lived tokens** (a leaked token used long after the support task) | TTL clamp (default 15 / cap 30 / floor 5 min, §2); `imp_exp` baked into the signed token and enforced on **every** request in every service (§5); session is revocable via `imp_sid`. |
| T5 | **Impersonating admins** without authority | Only `platform_admin` + documented break-glass code (`BREAK_GLASS` basis); all other actors `ADMIN_TARGET_FORBIDDEN`. |
| T6 | **Minor-data access without consent** | Minors require `GUARDIAN_CONSENT` or an `OPEN_INCIDENT`; justification tickets and platform overrides explicitly **cannot** bypass guardian consent (§4); tenant-disable short-circuits. |
| T7 | **Audit gaps / attribution loss** | `act` (acting admin) is always carried and never dropped; per-request `auth.impersonation.*` events; start/stop record the RBAC + consent basis; events land in the tamper-evident audit chain (ADR 0032). |
| T8 | **Forged claims** (client invents `imp`, `sub`, or `act`) | All impersonation claims live in the server-signed JWT; a client cannot mint or alter them without the signing key. |
| T9 | **Confused-deputy writes** (admin tricked into a damaging write as subject) | Deny-by-default write guard: the only writes possible are the narrow, explicitly-allowlisted ones, and only when the session was opened writes-on. |

## Alternatives considered

- **Full session swap** (log the admin out and into the subject's actual
  session). Rejected: loses the `act` identity entirely (audit evasion by
  design), no per-request write guard, and recovery requires re-login —
  worst-case attribution and blast radius.
- **Shadow / mirror accounts** (a parallel account the admin assumes).
  Rejected: drifts from the real user's state, doubles the data surface, and
  still requires bespoke audit plumbing; doesn't reflect what the user
  actually sees.
- **No writes ever under impersonation.** Considered as the default and
  largely adopted — but some support tasks legitimately need a narrow write
  (e.g. re-trigger a stuck action). We keep the spirit (deny-by-default) but
  allow an explicit, per-route, per-session allowlisted write rather than a
  blanket ban that would push staff back to direct DB edits.

## Consequences

**Positive**

- **Full auditability**: every impersonated request and write decision is
  logged with the real actor (`act`), in the tamper-evident chain.
- **Bounded blast radius**: deny-by-default writes + short TTL + per-tenant
  disable mean a misused or leaked session can do very little, briefly.
- **Forgery-resistant**: the security-relevant facts are signed, not
  client-asserted; the same guard runs in every service.
- **Minor protections are structural**, not advisory — the only minor paths
  are guardian-consent or an open incident.

**Negative / tradeoffs**

- The `impersonation_sessions` store is **in-memory today** alongside the
  Postgres schema in **migration 0049**; durable persistence + revocation
  across replicas is a tracked follow-up.
- **Fail-safe defaults** (deny writes, treat unknown-age as adult,
  tenant-disable short-circuit) trade some support convenience for safety;
  this is deliberate.
- Each service must register its own `imp-write-allowlist.ts`; an unwired
  service simply blocks all impersonated writes (safe default).

## References

- Migration: `services/identity-svc/src/db/migrations/0049_impersonation_sessions.sql` (migration 0049)
- Core logic: `services/identity-svc/src/lib/impersonation.ts`
- Shared write guard: `packages/enterprise-core/src/impersonation-guard.ts`
  (+ `fastify-auth.ts`)
- Per-service allowlist contract: `src/auth/imp-write-allowlist.ts`
- Frontend: StartImpersonationModal, ImpersonationBanner (TTL countdown +
  Exit), platform/district history viewers, AppShell watermark (`apps/web-v2`)
- Compliance review procedure: `docs/runbooks/impersonation-review.md`
- RFC 8693 (token exchange — `act` actor claim); ADR 0032 (audit chain)
