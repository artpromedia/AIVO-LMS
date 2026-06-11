# OIDC relying-party runbook — Okta & Microsoft Entra (Sprint B1)

How a district connects its IdP to AIVO. The flow is authorization-code +
PKCE, implemented in `services/identity-svc/src/routes/oidc-rp.ts`
(state/nonce/PKCE enforced; ID-token `iss`/`aud`/`nonce` verified against
the issuer's JWKS). JIT provisioning is restricted to district roles
(`DISTRICT_ADMIN`, `TEACHER`, `CAREGIVER`, `THERAPIST`) — an IdP can never
mint platform staff.

Self-serve config: web-admin → District → **Single sign-on**
(`/district/sso-config`), backed by `PUT /api/district/sso` (`oidc`
section; client secret AES-GCM-encrypted at rest, write-only — the UI only
ever sees `clientSecretSet`). "Test connection" runs LIVE discovery via
`POST /api/district/sso/oidc/test`.

Login entry: both login pages call `/api/auth/discover` on email blur;
a domain owned by an SSO district renders "Continue with <IdP>" (OIDC
preferred over SAML when both are enabled).

## Okta

1. Admin console → Applications → Create App Integration → **OIDC – Web
   Application**.
2. Sign-in redirect URI:
   `https://<aivo-origin>/api/sso/oidc/<tenantId>/callback`
   (tenantId is shown on the AIVO SSO settings page).
3. Assignments: the groups who may use AIVO.
4. (Role mapping) Sign-on → OpenID Connect ID Token → Groups claim filter
   (e.g. `groups` matches regex `aivo-.*`).
5. In AIVO: Issuer = `https://<org>.okta.com` (or the custom auth server
   issuer), Client ID/Secret from the app, Role claim = `groups`,
   role map e.g. `{"aivo-district-admins":"DISTRICT_ADMIN",
   "aivo-teachers":"TEACHER"}` (PUT accepts `roleMap`), default role
   Teacher, email domains = the district's domains.
6. **Test connection**, then Enabled → Save.

## Microsoft Entra ID

1. Entra admin center → App registrations → New registration (Web).
2. Redirect URI: `https://<aivo-origin>/api/sso/oidc/<tenantId>/callback`.
3. Certificates & secrets → new client secret.
4. Token configuration → add the `groups` claim (or an `roles` app-role
   setup) to the ID token; API permissions need `openid profile email`.
5. In AIVO: Issuer =
   `https://login.microsoftonline.com/<entra-tenant-id>/v2.0`,
   Client ID = Application (client) ID, secret from step 3, Role claim =
   `groups`/`roles` per step 4, email domains, role map.
6. **Test connection**, then Enabled → Save.

## Verification checklist (staging, release host — record per district)

| Step | Expectation |
| --- | --- |
| `POST /api/auth/discover {email:"x@district.org"}` | `mode:"sso"`, `ssoLoginUrl:/api/sso/oidc/<tenant>/login` |
| Browser: login page, type district email, blur | "Continue with <IdP>" renders |
| Click through, authenticate at IdP | Redirect lands on returnTo with AIVO session cookies |
| First-time user | JIT-provisioned with the mapped role; `provisionedBy:"oidc"` |
| User in no mapped group | Default role applied |
| Replay the callback URL | Rejected (state/nonce single-use TX cookie) |
| `last login` in web-admin users table | Updated |

Unit/negative coverage lives in
`services/identity-svc/tests/oidc-rp.test.ts` (PKCE, authorize URL params,
ID-token issuer/aud/nonce enforcement, role mapping, secret encryption,
discover preference).
