# LTI 1.3 Launch Contract

`validateLtiLaunch(payload, options)` validates an LTI 1.3 launch
request before any session is created. The validator focuses on safety
guarantees, not full token signature verification — that lives behind
a separate JWKS-aware service that can be plugged in later.

## Required Fields

```
issuer
client_id
deployment_id
target_link_uri
nonce
state
id_token
roles
context.id
resource_link.id
```

## Validation Rules

- Missing required field → `missing_field`.
- Missing `resource_link.id` → `missing_resource_link`.
- Missing `context.id` → `missing_context`.
- Empty `roles` → `missing_roles`.
- Issuer not in `trustedIssuers` (when supplied) → `untrusted_issuer`.
- **Production mode**: `id_token` that is missing, has fewer than
  three JWT segments, or has an empty signature → `unsigned_id_token`.
- Tests lock the "unsigned token rejected in production mode" gate.

## Feature Flag

`AIVO_FEATURE_LTI_13=true` enables the launch endpoint and tool
registration. With the flag off, the route is not registered.

## Endpoint

```
POST /api/lti/validate
```

Request:

```ts
{
  payload: LtiLaunchPayload;
  productionMode?: boolean;
  trustedIssuers?: string[];
}
```

Response:

```ts
{
  valid: boolean;
  issues: Array<{ code: string; message: string }>;
}
```
