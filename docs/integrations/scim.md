# SCIM 2.0 Provisioning

AIVO supports SCIM 2.0 user and group provisioning so districts can manage
staff accounts directly from their identity provider. When a user is
created, updated, or deactivated in the IdP, those changes are pushed to
AIVO automatically — there is no nightly CSV import to maintain.

## Quick start

1. **Issue a SCIM bearer token** in the AIVO district console under
   *Settings → Single Sign-On → SCIM provisioning tokens*. Copy the token
   immediately — AIVO never shows it again.
2. **Note your endpoints**:
   - Base URL: `https://app.aivolearning.com/scim/v2`
   - ServiceProviderConfig (read-only): `GET /scim/v2/ServiceProviderConfig`
   - Users: `/scim/v2/Users`
   - Groups (read-only): `/scim/v2/Groups`
3. Plug the URL + bearer token into your IdP's SCIM connector.

> Each token is scoped to a single tenant. Revoke it from the same screen
> the moment it's no longer needed; revocation takes effect immediately.

## Supported features

| Feature | Status |
| --- | --- |
| Users — create, read, update, replace, deactivate | ✅ |
| Users — hard delete | ✅ (treated as deactivate) |
| Filter `userName eq "..."` | ✅ |
| Filter `emails[type eq "work"].value eq "..."` | ✅ |
| Boolean filters with `and` / `or` | ✅ |
| Pagination (`startIndex`, `count`) | ✅ |
| PATCH operations (`replace`, `add`, `remove`) | ✅ |
| Groups — read, list (membership read-only) | ✅ |
| Groups — create / write membership | ❌ Use SAML role mapping instead |

> **Roles:** Provisioning is restricted to `DISTRICT_ADMIN`, `TEACHER`,
> `CAREGIVER`, and `THERAPIST`. Requests that try to provision a
> `PLATFORM_ADMIN` are rejected with HTTP 403 — platform-admin status can
> only be granted by AIVO support.

## Microsoft Entra ID (Azure AD)

1. In Entra → *Enterprise applications* → *New application* → search for
   "Non-gallery application" and create it as **AIVO**.
2. Open *Provisioning* → set mode to **Automatic**.
3. Under *Admin Credentials*, paste:
   - **Tenant URL:** `https://app.aivolearning.com/scim/v2`
   - **Secret Token:** the bearer token from the AIVO console
4. Click **Test Connection** — Entra issues a `GET /Users?count=1`. You
   should see *"The supplied credentials are authorized..."*.
5. Under *Mappings → Provision Microsoft Entra ID Users*, leave the
   default attribute mappings. Confirm `userPrincipalName → userName`,
   `mail → emails[type eq "work"].value`, and that the SCIM
   `urn:ietf:params:scim:schemas:extension:enterprise:2.0:User` attributes
   are mapped if you want manager / department metadata.
6. Set the **Scope** to *Sync only assigned users and groups*, assign the
   group of staff who should appear in AIVO, and click **Save** → **Start
   provisioning**.

### Role mapping with Entra

AIVO reads the SAML attribute named in *Settings → SSO → Advanced →
Role attribute* (default `https://aivo/role`). To send roles from Entra:

1. In *Single sign-on → User Attributes & Claims*, add a new claim:
   - **Name:** `https://aivo/role`
   - **Source:** `user.assignedroles`
2. Define app roles for AIVO (`aivo-district-admin`, `aivo-teacher`,
   `aivo-caregiver`, `aivo-therapist`).
3. Map them in the AIVO console under *Advanced → Role map*:
   ```
   aivo-district-admin=DISTRICT_ADMIN
   aivo-teacher=TEACHER
   aivo-caregiver=CAREGIVER
   aivo-therapist=THERAPIST
   ```

## Okta

1. In Okta → *Applications* → *Create App Integration* → choose **SAML 2.0**
   (or use the AIVO catalog entry once published).
2. Configure SAML: paste the ACS URL and Entity ID from the AIVO SSO
   settings page; upload the SP metadata if Okta requires it.
3. Open the new app's *Provisioning* tab → **Configure API Integration**:
   - Check *Enable API integration*.
   - **Base URL:** `https://app.aivolearning.com/scim/v2`
   - **API Token:** AIVO bearer token
   - Click **Test API Credentials** → save.
4. Under *Provisioning → To App*, enable **Create Users**, **Update User
   Attributes**, and **Deactivate Users**.
5. Under *Profile Editor*, ensure the `aivoRole` attribute exists (string)
   and is mapped from your Okta directory or assigned per-group.
6. Assign the AIVO app to the staff group and save.

### Role mapping with Okta

In *Sign On → SAML 2.0 → Edit attribute statements*, add:

| Name | Name format | Value |
| --- | --- | --- |
| `https://aivo/role` | URI Reference | `appuser.aivoRole` |

Then populate `aivoRole` either per-user or via Okta group rules.

## Filters AIVO accepts

```
userName eq "alice@school.org"
emails[type eq "work"].value eq "alice@school.org"
active eq true
userName eq "alice@school.org" and active eq true
userName eq "alice@school.org" or userName eq "bob@school.org"
```

Unsupported operators (`co`, `sw`, `pr`, `gt`, ...) currently return an
empty result set rather than 400 — file a ticket if your IdP needs them.

## Troubleshooting

- **HTTP 401 with `{"detail":"Invalid token"}`** — the bearer token was
  revoked or doesn't belong to your tenant. Issue a fresh token.
- **HTTP 403 on a `PLATFORM_ADMIN` payload** — expected; AIVO never
  provisions platform admins via SCIM.
- **Created users can't log in** — confirm the SAML side is also
  configured; SCIM only sets up the account, SAML is what authenticates
  the session.
- **Deactivated user reactivated unexpectedly** — Entra sends `active:
  true` on every sync if the user is still in the assigned group. AIVO
  honours that — to truly remove access, unassign the user from the AIVO
  group in the IdP.

## Audit trail

Every SCIM mutation is recorded in `district_activity_log` with the
acting token's name and the resulting user ID. Tokens themselves are
audited in `audit_events` on issue/revoke.
