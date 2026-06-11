# SCIM Provisioning Runbook (Okta + Microsoft Entra)

_Sprint B5. Audience: AIVO solutions engineers and district IT admins
connecting an IdP to AIVO's SCIM 2.0 endpoint. Feature reference:
[scim.md](./scim.md)._

## What you get

- Staff accounts (district admins, teachers, caregivers, therapists)
  created, updated, deactivated, and reactivated from the IdP — no CSV
  cycles. Both SCIM and the SIS pipeline apply through the same
  roster core in identity-svc (`src/services/roster-core.ts`), so
  provisioning semantics are identical regardless of source.
- Push groups named to the class convention become AIVO classrooms with
  their teacher of record and school staff assignments.
- Every mutation lands on the tamper-evident audit trail; sync counters
  and the unmapped-group review list live on the district SIS page.

## Endpoint + auth

| Item        | Value                                              |
| ----------- | -------------------------------------------------- |
| Base URL    | `https://app.aivolearning.com/scim/v2`             |
| Auth        | `Authorization: Bearer <token>` (OAuth bearer)     |
| Token source| District console → _SIS connectors → SCIM provisioning_ → **Issue token** (shown once) |
| Discovery   | `/ServiceProviderConfig`, `/Schemas`, `/ResourceTypes` (no auth required, per RFC 7644 §4) |

Rotation: issue a second token, switch the IdP to it, then revoke the
old one (revocation is immediate). `lastUsedAt` on the SIS page tells
you when the IdP last called.

## Attribute mappings

| AIVO field        | SCIM attribute                          | Okta default            | Entra default              |
| ----------------- | --------------------------------------- | ----------------------- | -------------------------- |
| email (login)     | `userName` (fallback `emails[0].value`)  | `user.email`            | `userPrincipalName`        |
| display name      | `displayName` or `name.formatted`        | first + last            | `displayName`              |
| role              | `aivoRole` (custom) or enterprise `department` | `appuser.aivoRole` | extension attribute → `department` |
| stable key        | `externalId`                             | Okta user id            | `objectId`                 |
| active            | `active` (bool; Entra string "True"/"False" accepted) | managed | managed       |

Role values: `DISTRICT_ADMIN`, `TEACHER`, `CAREGIVER`, `THERAPIST`.
Anything else is refused (`PLATFORM_ADMIN` always 403s — platform-admin
status is granted only by AIVO support). Students are never SCIM users —
learners roster through enrollments/SIS.

## Class groups (push groups)

Name a pushed group exactly:

```
Class: <School Name> / <Class Name>
```

e.g. `Class: Lincoln Elementary / Grade 3 – Room B`.

- `<School Name>` must match a school in the district
  (case-insensitive). Unknown school → the push is refused AND recorded
  for review; nothing is created.
- The classroom is created (or matched by name) under that school. The
  FIRST member becomes teacher of record; every member gets a staff
  assignment at the school.
- Membership add/remove from the IdP updates the class (Okta
  value-array and Entra `members[value eq "…"]` PatchOp forms both
  accepted).
- Groups that don't match the convention (e.g. Okta's `Everyone`) are
  refused with an explanatory SCIM error, recorded, and listed on the
  SIS page under _Group pushes needing review_ — rename the group in the
  IdP to import it, or mark the row reviewed to dismiss it.
- Group DELETE never deletes a class (enrollment history): archive the
  class from the AIVO console instead.

## Okta setup

1. _Applications → Create App Integration_ → **SAML 2.0** (SSO per the
   [OIDC/SAML runbook](../auth/oidc-rp-runbook.md)); SCIM rides on the
   same app.
2. App → _General → App Settings_ → **Enable SCIM provisioning**.
3. _Provisioning → Integration_:
   - SCIM connector base URL: `https://app.aivolearning.com/scim/v2`
   - Unique identifier field: `userName`
   - Supported actions: **Push New Users, Push Profile Updates, Push Groups**
   - Authentication: **HTTP Header** → paste the AIVO bearer token.
   - **Test Connector Configuration** → Okta calls
     `GET /Users?startIndex=1&count=1` and `/ServiceProviderConfig`.
4. _Provisioning → To App_: enable **Create Users**, **Update User
   Attributes**, **Deactivate Users**.
5. _Profile Editor_ → AIVO app profile → add attribute `aivoRole`
   (string) and map it (per group rule or directory attribute).
6. _Push Groups_ → add groups named to the class convention.
7. Assign the staff group to the app.

Okta request shapes AIVO is tested against
(`services/identity-svc/tests/scim-conformance.test.ts`):

- create: POST `/Users` with `userName`, `name`, `emails[]`, `externalId`
- deactivate: PATCH `{"Operations":[{"op":"replace","value":{"active":false}}]}` (no `path`)
- group push: POST `/Groups` `{displayName, members:[{value}]}` then
  membership PATCHes with `path:"members"` value arrays.

## Microsoft Entra setup

1. _Enterprise applications → New application → Create your own_ →
   **AIVO**.
2. _Provisioning_ → mode **Automatic**:
   - Tenant URL: `https://app.aivolearning.com/scim/v2`
   - Secret token: the AIVO bearer token
   - **Test Connection**.
3. _Mappings → Provision Microsoft Entra ID Users_: keep defaults;
   confirm `userPrincipalName → userName`, `objectId → externalId`, and
   map the enterprise extension `department` to the AIVO role value if
   you drive roles from Entra.
4. Scope: _Sync only assigned users and groups_; assign the staff
   group(s); **Start provisioning**.

Entra request shapes AIVO is tested against: enterprise-extension
creates, capitalized PatchOp verbs (`"op":"Replace"`), string booleans
(`"value":"False"`), and `members[value eq "<id>"]` removal paths.

## Verification checklist (run after connecting)

1. IdP test-connection passes (200 from `/ServiceProviderConfig` and
   `/Users?count=1`).
2. Assign one pilot teacher → appears in AIVO district staff within one
   sync cycle; `SCIM_USER_CREATED` counter increments on the SIS page.
3. Rename the pilot user in the IdP → name updates in AIVO
   (`SCIM_USER_PATCHED` / `SCIM_USER_REPLACED`).
4. Unassign (Okta) / soft-delete (Entra) → user shows deactivated in
   AIVO; sign-in is refused; row is retained (soft delete only).
5. Push one conventional class group → classroom appears with teacher of
   record; push one off-convention group → it appears under _Group
   pushes needing review_.
6. District audit page shows the SCIM_* trail; chain verification stays
   intact.

## Staging verification status

The conformance suite drives the endpoints with recorded Okta and Entra
payload shapes on every CI run. An end-to-end recording against a live
IdP dev tenant (Okta developer org / Entra test tenant) requires
outbound network access to that tenant and is **pending**: run the
checklist above against staging and paste the sync log + screenshots
here when the connection is first exercised.

## Operational notes

- 401 from every IdP call → token revoked/wrong tenant: issue a fresh
  token on the SIS page.
- The unmapped-group list deduplicates repeat pushes
  (`seenCount`/`lastSeenAt`) — a noisy IdP can't flood it.
- All SCIM writes go through identity-svc's roster core; if a future
  importer needs the same semantics, call the core, don't fork it.
