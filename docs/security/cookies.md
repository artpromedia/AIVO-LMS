# Cookie inventory and flag policy (Sprint A3)

Closes the ZAP #65 "Cookie No HttpOnly Flag" / "Cookie Without Secure
Flag" findings by documenting every cookie the web surfaces set and the
reason for each deliberate exception.

| Cookie | Set by | HttpOnly | Secure | SameSite | Why |
| --- | --- | --- | --- | --- | --- |
| aivo_access_token | server (login) | yes | prod | Lax | session JWT |
| aivo_refresh_token | server (login) | yes | prod | Lax | refresh, server-only |
| aivo_session | server (login) | yes | prod | Lax | RSC continuity snapshot |
| aivo_mock_session | server (mock-login, dev-only) | yes | prod | Lax | refused outside AUTH_MODE=mock |
| MFA challenge | server (login) | yes | prod | Lax | 15-min TTL |
| active-role / session-roles | server | yes | prod | Lax | multi-role overlay |
| active-learner | server | yes | prod | Lax | parent's selected learner |
| impersonation banner | server | **no** | prod | Lax | DELIBERATE: client banner reads the countdown (`endsAt`); contains no secret — the impersonation AUTHORITY lives in the httpOnly session; see `app/api/bff/admin/impersonation/start/route.ts` |
| locale (NEXT_LOCALE-style) | client JS (language switcher) | n/a (JS-set) | https only | Lax | UI preference, non-secret; `secure` added when served over https |

Rules:
1. Any cookie carrying authority MUST be `HttpOnly; SameSite=Lax;
   Secure (prod)` — no exceptions.
2. Client-readable cookies are allowed only for non-secret UI state and
   must say so in a code comment at the set site.
3. New cookies require a row in this table (reviewed in security review).
